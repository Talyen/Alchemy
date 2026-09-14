import { describe, expect, it, vi } from "vitest";
import { animateHurtSparks, createHurtSparks } from "@/lib/animation/hurt-sparks";

describe("hurt-sparks", () => {
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
