import { describe, expect, it } from "vitest";
import {
  SLICE_ANGLE_RADIANS,
  SLICE_ASPECT_HEIGHT,
  SLICE_ASPECT_WIDTH,
  SLICE_CARD_FRACTION_RANGE,
  SLICE_CRACK_POINTS,
  SLICE_NORMAL,
  SLICE_PRIMARY_CLIP_PATH,
  SLICE_SECONDARY_CLIP_PATH,
  sliceCrackPointAtFraction,
  sliceCrackSide,
} from "@/lib/animation/slice-crack";
import { computeSliceVisual, SLICE_CRACK_OPEN_START, SLICE_SPLIT_DELAY } from "@/lib/animation/slice-timeline";

function parseClipPolygon(clipPath: string): { x: number; y: number }[] {
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
  it("keeps interior vertices on the card", () => {
    const interior = SLICE_CRACK_POINTS.slice(1, -1);
    for (const point of interior) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(1);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(1);
    }
  });

  it("extends endpoints past the card", () => {
    const onBoundary = (p: { x: number; y: number }) =>
      Math.abs(p.x) < 0.0001 || Math.abs(p.x - 1) < 0.0001 || Math.abs(p.y) < 0.0001 || Math.abs(p.y - 1) < 0.0001;
    expect(onBoundary(SLICE_CRACK_POINTS[0]!)).toBe(false);
    expect(onBoundary(SLICE_CRACK_POINTS[SLICE_CRACK_POINTS.length - 1]!)).toBe(false);
  });

  it("zigzags interior vertices across the base diagonal", () => {
    const interior = SLICE_CRACK_POINTS.slice(1, -1);
    expect(interior.length).toBeGreaterThanOrEqual(3);
    let previousSign: number | undefined;
    for (const point of interior) {
      const dx = (point.x - 0.5) * SLICE_ASPECT_WIDTH;
      const dy = (point.y - 0.5) * SLICE_ASPECT_HEIGHT;
      const sign = dx * SLICE_NORMAL.dx + dy * SLICE_NORMAL.dy >= 0 ? 1 : -1;
      if (previousSign !== undefined) {
        expect(sign * previousSign).toBeLessThan(0);
      }
      previousSign = sign;
    }
  });

  it("classifies card corners onto opposite half-planes", () => {
    expect(sliceCrackSide({ x: 0.95, y: 0.05 })).toBeGreaterThan(0);
    expect(sliceCrackSide({ x: 0.05, y: 0.95 })).toBeLessThan(0);
  });

  it("keeps card corners inside the matching half clip-path", () => {
    const upperRight = { x: 0.99, y: 0.01 };
    const lowerLeft = { x: 0.01, y: 0.99 };
    expect(pointInClipPolygon(SLICE_SECONDARY_CLIP_PATH, upperRight)).toBe(true);
    expect(pointInClipPolygon(SLICE_PRIMARY_CLIP_PATH, upperRight)).toBe(false);
    expect(pointInClipPolygon(SLICE_PRIMARY_CLIP_PATH, lowerLeft)).toBe(true);
    expect(pointInClipPolygon(SLICE_SECONDARY_CLIP_PATH, lowerLeft)).toBe(false);
  });

  it("advances along the crack as fraction increases", () => {
    const start = SLICE_CRACK_POINTS[0]!;
    const low = sliceCrackPointAtFraction(0.2);
    const high = sliceCrackPointAtFraction(0.8);
    const distance = (p: { x: number; y: number }) => Math.hypot(p.x - start.x, p.y - start.y);
    expect(distance(high)).toBeGreaterThan(distance(low));
  });

  it("keeps the on-card fraction range inside the padded polyline", () => {
    expect(SLICE_CARD_FRACTION_RANGE.start).toBeGreaterThan(0);
    expect(SLICE_CARD_FRACTION_RANGE.end).toBeLessThan(1);
    const nearBoundary = (p: { x: number; y: number }) =>
      Math.abs(p.x) < 0.04 || Math.abs(p.x - 1) < 0.04 || Math.abs(p.y) < 0.04 || Math.abs(p.y - 1) < 0.04;
    expect(nearBoundary(sliceCrackPointAtFraction(SLICE_CARD_FRACTION_RANGE.start))).toBe(true);
    expect(nearBoundary(sliceCrackPointAtFraction(SLICE_CARD_FRACTION_RANGE.end))).toBe(true);
  });

  it("uses a left-leaning cut angle", () => {
    expect(SLICE_ANGLE_RADIANS).toBeLessThan(0);
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
