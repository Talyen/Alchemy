import { afterEach, describe, expect, it, vi } from "vitest";
import { animateHurtSparks, createHurtSparks } from "@/lib/animation/hurt-sparks";

describe("hurt-sparks", () => {
  afterEach(() => vi.restoreAllMocks());
  describe("createHurtSparks", () => {
    it("generates the requested number of sparks with initial alpha 1", () => {
      const sparks = createHurtSparks(300, 200, 20);
      expect(sparks).toHaveLength(20);
      for (const spark of sparks) {
        expect(spark.alpha).toBe(1);
        expect(spark.size).toBeGreaterThan(0);
        expect(spark.x).toBeGreaterThanOrEqual(0);
        expect(spark.x).toBeLessThanOrEqual(300);
        expect(spark.y).toBeGreaterThanOrEqual(0);
        expect(spark.y).toBeLessThanOrEqual(200);
      }
    });

    it("samples from vertical edges when requested", () => {
      const sparks = createHurtSparks(
        300,
        200,
        10,
        ["#ff0000"],
        { x: 50, y: 50, width: 100, height: 100 },
        {
          edges: "vertical",
        },
      );
      expect(sparks).toHaveLength(10);
      for (const spark of sparks) {
        expect(spark.color).toBe("#ff0000");
        const onLeftOrRight = Math.abs(spark.x - 52) < 0.1 || Math.abs(spark.x - 148) < 0.1;
        expect(onLeftOrRight).toBe(true);
      }
    });
  });

  describe("animateHurtSparks", () => {
    it("writes one color per consecutive run without reordering sparks", () => {
      let frame!: FrameRequestCallback;
      vi.spyOn(performance, "now").mockReturnValue(0);
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
        frame = callback;
        return 1;
      });
      vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
      const sparks = createHurtSparks(100, 100, 4, ["red"]);
      sparks[3]!.color = "blue";
      const colorWrites: string[] = [];
      const draws: string[] = [];
      let color = "";
      const ctx = {
        clearRect: vi.fn(),
        globalAlpha: 1,
        get fillStyle() {
          return color;
        },
        set fillStyle(value: string) {
          colorWrites.push(value);
          color = value;
        },
        fillRect() {
          draws.push(color);
        },
      } as unknown as CanvasRenderingContext2D;
      const stop = animateHurtSparks(ctx, sparks, 100, 100, 1000, vi.fn());
      for (const now of [0, 16.67]) {
        colorWrites.length = 0;
        draws.length = 0;
        frame(now);
        expect(colorWrites).toEqual(["red", "blue"]);
        expect(draws).toEqual(["red", "red", "red", "blue"]);
      }
      stop();
    });

    it("preserves every spark's drawing and motion across the fade cutoff", () => {
      const frames: FrameRequestCallback[] = [];
      vi.spyOn(performance, "now").mockReturnValue(0);
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => frames.push(cb));
      vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
      const sparks = createHurtSparks(300, 200, 48);
      sparks[0]!.alpha = 0.005;
      const reference = sparks.map((spark) => ({ ...spark }));
      const actual: unknown[][] = [];
      const alphaWrites: number[] = [];
      let alpha = 1;
      const ctx = {
        clearRect: vi.fn(),
        fillStyle: "",
        get globalAlpha() {
          return alpha;
        },
        set globalAlpha(value: number) {
          alphaWrites.push(value);
          alpha = value;
        },
        fillRect(x: number, y: number, w: number, h: number) {
          actual.push([this.fillStyle, alpha, x, y, w, h]);
        },
      } as unknown as CanvasRenderingContext2D;
      const onComplete = vi.fn();
      const stop = animateHurtSparks(ctx, sparks, 300, 200, 1000, onComplete);
      let lastTime = 0;
      for (const now of [0, 16.67, 400, 995, 999, 1000]) {
        actual.length = 0;
        alphaWrites.length = 0;
        const expected: unknown[][] = [];
        const dt = Math.min((now - lastTime) / 16.67, 3);
        const progress = Math.min(now / 1000, 1);
        lastTime = now;
        for (const p of reference) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.94;
          p.vy *= 0.94;
          if (p.alpha <= 0.01) continue;
          p.alpha = Math.max(0, 1 - progress * progress);
          expected.push([p.color, p.alpha, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size]);
        }
        frames.shift()!(now);
        expect(actual).toEqual(expected);
        expect(sparks).toEqual(reference);
        expect(ctx.globalAlpha).toBe(1);
        expect(alphaWrites).toHaveLength(2);
      }
      expect(onComplete).toHaveBeenCalledOnce();
      stop();
    });

    it("runs particle loop and completes", () => {
      let frameCallback: FrameRequestCallback | null = null;
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
        frameCallback = cb;
        return 1;
      });

      const ctx = {
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        globalAlpha: 1,
        fillStyle: "",
      } as unknown as CanvasRenderingContext2D;

      const sparks = createHurtSparks(100, 100, 5);
      const onComplete = vi.fn();
      const cancel = animateHurtSparks(ctx, sparks, 100, 100, 100, onComplete);

      expect(frameCallback).not.toBeNull();
      frameCallback!(performance.now() + 150);
      expect(onComplete).toHaveBeenCalledOnce();
      cancel();
    });
  });
});
