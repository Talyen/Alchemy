import { describe, expect, it } from "vitest";
import { drawSliceFrameReference } from "../../fixtures/slice-draw-reference";
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
    expect(sampleBorderSpark(border, 2, 200, 150, scratch)).toBeNull();
    expect(sampleCutSpark(cut, 2, 200, 150, scratch)).toBeNull();
    expect(scratch).toEqual({ x: 11, y: 22, diameter: 33, opacity: 44 });

    expect(sampleBorderSpark(border, 0.4, 200, 150, scratch)).toBe(scratch);
    expect(scratch).toEqual(sampleBorderSpark(border, 0.4, 200, 150));
    const progress = cut.delay + cut.lifetime * 0.5;
    expect(sampleCutSpark(cut, progress, 200, 150, scratch)).toBe(scratch);
    expect(scratch).toEqual(sampleCutSpark(cut, progress, 200, 150));
  });
});

describe("drawSliceFrame", () => {
  it("preserves exact drawing commands across sizes and the full animation", () => {
    let commands: unknown[] = [];
    const expected: unknown[] = [];
    const actual: unknown[] = [];
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
        const visual = computeSliceVisual(progress, width, height);
        commands = expected;
        commands.push([width, height, progress]);
        drawSliceFrameReference(ctx, visual, width, height, width / 2, height / 2);
        commands = actual;
        commands.push([width, height, progress]);
        drawSliceFrame(ctx, visual, width, height, width / 2, height / 2);
      }
    }

    // Exact numeric equality on the same host, including paths, color/alpha
    // state, spark coordinates and draw ordering. No rounding or tolerance.
    expect(actual).toEqual(expected);
  });
});
