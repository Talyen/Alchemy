import { describe, expect, it } from "vitest";
import {
  SLICE_CARD_FRACTION_RANGE,
  SLICE_PRIMARY_CLIP_PATH,
  SLICE_SECONDARY_CLIP_PATH,
  sliceCrackPointAtFraction,
  sliceCrackSide,
} from "@/lib/animation/slice-crack";
import { computeSliceVisual, SLICE_CRACK_OPEN_START, SLICE_SPLIT_DELAY } from "@/lib/animation/slice-timeline";

function parseClipPolygon(clipPath: string): Array<{ x: number; y: number }> {
  const inner = clipPath.match(/^polygon\((.+)\)$/)?.[1];
  if (!inner) throw new Error(`expected polygon clip-path, got ${clipPath}`);
  return inner.split(",").map((pair) => {
    const [xToken, yToken] = pair.trim().split(/\s+/);
    return { x: Number.parseFloat(xToken!) / 100, y: Number.parseFloat(yToken!) / 100 };
  });
}

function pointInClipPolygon(clipPath: string, point: { x: number; y: number }): boolean {
  const verts = parseClipPolygon(clipPath);
  let inside = false;
  for (let index = 0, prev = verts.length - 1; index < verts.length; prev = index, index++) {
    const a = verts[index]!;
    const b = verts[prev]!;
    const intersects = a.y > point.y !== b.y > point.y;
    if (!intersects) continue;
    const atX = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (point.x < atX) inside = !inside;
  }
  return inside;
}

describe("slice crack", () => {
  it("covers the portrait exactly once with complementary halves", () => {
    const violations: string[] = [];
    for (let x = 0.013; x < 1; x += 0.037) {
      for (let y = 0.017; y < 1; y += 0.041) {
        const point = { x, y };
        if (Math.abs(sliceCrackSide(point)) < 0.01) continue;
        const primary = pointInClipPolygon(SLICE_PRIMARY_CLIP_PATH, point);
        const secondary = pointInClipPolygon(SLICE_SECONDARY_CLIP_PATH, point);
        if (Number(primary) + Number(secondary) !== 1 || primary !== sliceCrackSide(point) < 0)
          violations.push(`(${x.toFixed(3)}, ${y.toFixed(3)}): primary=${primary}, secondary=${secondary}`);
      }
    }
    expect({ total: violations.length, examples: violations.slice(0, 5) }).toEqual({ total: 0, examples: [] });
  });

  it("keeps the on-card fraction range inside the padded polyline", () => {
    expect(SLICE_CARD_FRACTION_RANGE.start).toBeGreaterThan(0);
    expect(SLICE_CARD_FRACTION_RANGE.end).toBeLessThan(1);
    const nearBoundary = (p: { x: number; y: number }) =>
      Math.abs(p.x) < 0.04 || Math.abs(p.x - 1) < 0.04 || Math.abs(p.y) < 0.04 || Math.abs(p.y - 1) < 0.04;
    expect(nearBoundary(sliceCrackPointAtFraction(SLICE_CARD_FRACTION_RANGE.start))).toBe(true);
    expect(nearBoundary(sliceCrackPointAtFraction(SLICE_CARD_FRACTION_RANGE.end))).toBe(true);
  });
});

describe("slice timeline", () => {
  it("holds the split closed until the delay", () => {
    const before = computeSliceVisual(SLICE_SPLIT_DELAY, 200, 150);
    expect(before.splitT).toBe(0);
    expect(before.dissolve).toBe(0);
    expect(before.crackT).toBe(1);
  });

  it("opens the fissure after the crack draw", () => {
    const atOpen = computeSliceVisual(SLICE_CRACK_OPEN_START, 200, 150);
    expect(atOpen.crackT).toBe(0);
    const afterOpen = computeSliceVisual(SLICE_CRACK_OPEN_START + 0.06, 200, 150);
    expect(afterOpen.crackT).toBe(1);
    expect(afterOpen.gap).toBeGreaterThan(atOpen.gap);
  });

  it("separates halves and fades them by the end of the clip", () => {
    const end = computeSliceVisual(1, 200, 150);
    expect(end.splitT).toBe(1);
    expect(end.halfOpacity).toBe(0);
    expect(end.gap).toBeGreaterThan(20);
    expect(end.lineOpacity).toBe(0);
  });
});
