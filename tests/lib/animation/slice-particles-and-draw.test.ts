import { expect, it, vi } from "vitest";
import { drawSliceFrame } from "@/lib/animation/slice-draw";
import {
  sampleBorderSpark,
  sampleCutSpark,
  SLICE_CUT_PARTICLES,
  SLICE_LEFT_BORDER_PARTICLES,
} from "@/lib/animation/slice-particles";
import { computeSliceVisual } from "@/lib/animation/slice-timeline";

it("slice-particles supports reusable storage without overwriting it for invisible sparks", () => {
  const scratch = { x: 11, y: 22, diameter: 33, opacity: 44 };
  const border = SLICE_LEFT_BORDER_PARTICLES[0]!;
  const cut = SLICE_CUT_PARTICLES[0]!;
  expect(sampleBorderSpark(border, -0.1, 200, 150, scratch)).toBeNull();
  expect(sampleCutSpark(cut, -0.1, 200, 150, scratch)).toBeNull();
  expect(sampleBorderSpark(border, 2, 200, 150, scratch)).toBeNull();
  expect(sampleCutSpark(cut, 2, 200, 150, scratch)).toBeNull();
  expect(scratch).toEqual({ x: 11, y: 22, diameter: 33, opacity: 44 });

  expect(sampleBorderSpark(border, 0.4, 200, 150, scratch)).toBe(scratch);
  expect(scratch).toEqual(sampleBorderSpark(border, 0.4, 200, 150));
  const progress = cut.delay + cut.lifetime * 0.5;
  expect(sampleCutSpark(cut, progress, 200, 150, scratch)).toBe(scratch);
  expect(scratch).toEqual(sampleCutSpark(cut, progress, 200, 150));
});

it("clears the previous slice frame and leaves no sparks or leaked alpha after completion", () => {
  const ctx = {
    canvas: { width: 400, height: 300 },
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    globalAlpha: 1,
  };
  const draw = (progress: number) =>
    drawSliceFrame(
      ctx as unknown as CanvasRenderingContext2D,
      computeSliceVisual(progress, 200, 150),
      200,
      150,
      100,
      75,
    );
  draw(0.1);
  expect(ctx.fill).toHaveBeenCalled();
  ctx.fill.mockClear();
  draw(1);
  expect(ctx.clearRect).toHaveBeenLastCalledWith(0, 0, 400, 300);
  expect(ctx.fill).not.toHaveBeenCalled();
  expect(ctx.globalAlpha).toBe(1);
});
