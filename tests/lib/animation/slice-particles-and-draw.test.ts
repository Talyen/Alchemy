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
});
