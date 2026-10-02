import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { drawSliceFrame } from "@/lib/animation/slice-draw";
import {
  sampleBorderSpark,
  sampleCutSpark,
  SLICE_CUT_PARTICLES,
  SLICE_LEFT_BORDER_PARTICLES,
} from "@/lib/animation/slice-particles";
import { computeSliceVisual } from "@/lib/animation/slice-timeline";

describe("slice-particles", () => {
  it("supports reusable storage without overwriting it for invisible sparks", () => {
    const scratch = { x: 11, y: 22, diameter: 33, opacity: 44 };
    const border = SLICE_LEFT_BORDER_PARTICLES[0]!;
    const cut = SLICE_CUT_PARTICLES[0]!;
    expect(sampleBorderSpark(border, -0.1, 200, 150, scratch)).toBeNull();
    expect(sampleCutSpark(cut, -0.1, 200, 150, scratch)).toBeNull();
    expect(scratch).toEqual({ x: 11, y: 22, diameter: 33, opacity: 44 });

    expect(sampleBorderSpark(border, 0.4, 200, 150, scratch)).toBe(scratch);
    expect(scratch).toEqual(sampleBorderSpark(border, 0.4, 200, 150));
    const progress = cut.delay + cut.lifetime * 0.5;
    expect(sampleCutSpark(cut, progress, 200, 150, scratch)).toBe(scratch);
    expect(scratch).toEqual(sampleCutSpark(cut, progress, 200, 150));
  });

  describe("sampleBorderSpark", () => {
    it("returns null before delay or after expiration", () => {
      const particle = SLICE_LEFT_BORDER_PARTICLES[0]!;
      expect(sampleBorderSpark(particle, -0.1, 200, 300)).toBeNull();
      expect(sampleBorderSpark(particle, 2.0, 200, 300)).toBeNull();
    });

    it("samples coordinates and properties during active lifetime", () => {
      const particle = SLICE_LEFT_BORDER_PARTICLES[0]!;
      const sample = sampleBorderSpark(particle, 0.4, 200, 300);
      if (sample) {
        expect(sample.diameter).toBeGreaterThan(0);
        expect(sample.opacity).toBeGreaterThan(0);
        expect(sample.opacity).toBeLessThanOrEqual(1);
        expect(Number.isFinite(sample.x)).toBe(true);
        expect(Number.isFinite(sample.y)).toBe(true);
      }
    });
  });

  describe("sampleCutSpark", () => {
    it("returns null when outside particle lifetime", () => {
      const particle = SLICE_CUT_PARTICLES[0]!;
      expect(sampleCutSpark(particle, -0.5, 200, 300)).toBeNull();
      expect(sampleCutSpark(particle, 2.0, 200, 300)).toBeNull();
    });

    it("returns finite spark samples while active", () => {
      const particle = SLICE_CUT_PARTICLES[0]!;
      const sample = sampleCutSpark(particle, particle.delay + particle.lifetime * 0.5, 200, 300);
      expect(sample).not.toBeNull();
      if (sample) {
        expect(sample.diameter).toBeGreaterThan(0);
        expect(sample.opacity).toBeGreaterThan(0);
        expect(Number.isFinite(sample.x)).toBe(true);
        expect(Number.isFinite(sample.y)).toBe(true);
      }
    });
  });
});

describe("drawSliceFrame", () => {
  it("preserves exact drawing commands across sizes and the full animation", () => {
    const commands: unknown[] = [];
    const ctx = new Proxy(
      { canvas: { width: 0, height: 0 } },
      {
        get(target, key) {
          if (key === "canvas") return target.canvas;
          return (...args: unknown[]) => commands.push([key, ...args]);
        },
        set(_target, key, value) {
          commands.push([key, value]);
          return true;
        },
      },
    ) as unknown as CanvasRenderingContext2D;

    for (const [width, height] of [
      [200, 150],
      [257, 193],
      [120, 240],
    ] as const) {
      ctx.canvas.width = width * 2;
      ctx.canvas.height = height * 2;
      for (const progress of [0, 0.01, 0.04, 0.08, 0.14, 0.22, 0.35, 0.5, 0.6, 0.8, 0.9, 1]) {
        commands.push([width, height, progress]);
        drawSliceFrame(ctx, computeSliceVisual(progress, width, height), width, height, width / 2, height / 2);
      }
    }

    // Recorded before sample-storage reuse; includes paths, color/alpha state,
    // spark coordinates and draw ordering without a large command fixture.
    expect(createHash("sha256").update(JSON.stringify(commands)).digest("hex")).toMatchInlineSnapshot(
      `"5452492cdbd82ac8c1111dd0d332595e5d40441c01e77c81c56bb13983bf489a"`,
    );
  });

  function createMockCtx(): CanvasRenderingContext2D {
    return {
      canvas: { width: 400, height: 300 } as HTMLCanvasElement,
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      globalAlpha: 1,
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      lineCap: "butt",
      lineJoin: "miter",
    } as unknown as CanvasRenderingContext2D;
  }

  it("renders crack, cut sparks, and border sparks during split phase", () => {
    const ctx = createMockCtx();
    const visual = computeSliceVisual(0.5, 200, 300);
    drawSliceFrame(ctx, visual, 200, 300, 100, 50);

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 400, 300);
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it("draws crack polyline and stroke during crack draw phase", () => {
    const ctx = createMockCtx();
    const visual = computeSliceVisual(0.04, 200, 300);
    drawSliceFrame(ctx, visual, 200, 300, 100, 50);

    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalled();
  });
  it("clears every visual at completion", () => {
    const ctx = createMockCtx();
    drawSliceFrame(ctx, computeSliceVisual(1, 200, 150), 200, 150, 100, 50);
    expect(ctx.clearRect).toHaveBeenCalledOnce();
    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.stroke).not.toHaveBeenCalled();
  });
});

describe("traceSliceCrackPath", () => {
  it("traces along polyline points to canvas context without allocating arrays", async () => {
    const { traceSliceCrackPath } = await import("@/lib/animation/slice-crack");
    const moveTo = vi.fn();
    const lineTo = vi.fn();
    const ctx = { moveTo, lineTo } as unknown as CanvasRenderingContext2D;

    const tip = traceSliceCrackPath(ctx, 0.5, 200, 300, 10, 20);
    expect(moveTo).toHaveBeenCalledOnce();
    expect(lineTo).toHaveBeenCalled();
    expect(tip).not.toBeNull();
    expect(Number.isFinite(tip?.tipX)).toBe(true);
    expect(Number.isFinite(tip?.tipY)).toBe(true);
  });
});
