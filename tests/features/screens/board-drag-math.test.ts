import { describe, expect, it } from "vitest";
import {
  applyMagnetHysteresis,
  distanceBetweenRects,
  rectCenter,
  sameDestinationIdentity,
  type MagnetHysteresisInput,
} from "@/features/alchemy/meta/screens/armory/board-drag-math";
import type { DragDestination, DragRect } from "@/features/alchemy/meta/screens/armory/use-board-drag";

const inv = (col: number, row: number, left: number, top: number): DragDestination => ({
  kind: "inventory",
  placement: { col, row },
  rect: { left, top, width: 10, height: 10 },
});

const ext = (left: number, top: number): DragDestination => ({
  kind: "external",
  rect: { left, top, width: 10, height: 10 },
});

const free = (left: number, top: number): DragRect => ({ left, top, width: 10, height: 10 });

describe("rectCenter", () => {
  it("returns the geometric center of a rect", () => {
    expect(rectCenter({ left: 0, top: 0, width: 10, height: 20 })).toEqual({ x: 5, y: 10 });
  });
});

describe("distanceBetweenRects", () => {
  it("is zero for identical rects", () => {
    expect(distanceBetweenRects(free(0, 0), free(0, 0))).toBe(0);
  });

  it("matches the Euclidean distance between centers", () => {
    const a = free(0, 0);
    const b = free(30, 40);
    expect(distanceBetweenRects(a, b)).toBeCloseTo(50, 5);
  });
});

describe("sameDestinationIdentity", () => {
  it("treats inventory destinations with the same placement as equal", () => {
    expect(sameDestinationIdentity(inv(1, 2, 0, 0), inv(1, 2, 999, 999))).toBe(true);
  });

  it("rejects inventory destinations with different placements", () => {
    expect(sameDestinationIdentity(inv(1, 2, 0, 0), inv(3, 4, 0, 0))).toBe(false);
  });

  it("treats external destinations as identity-equal by kind only", () => {
    expect(sameDestinationIdentity(ext(0, 0), ext(0, 0))).toBe(true);
  });

  it("rejects cross-kind comparisons", () => {
    expect(sameDestinationIdentity(inv(1, 1, 0, 0), ext(0, 0))).toBe(false);
  });
});

describe("applyMagnetHysteresis", () => {
  const input = (
    candidate: DragDestination | null,
    previousDestination: DragDestination | null,
    freeRect: DragRect,
  ): MagnetHysteresisInput<DragDestination> => ({ candidate, previousDestination, freeRect });

  it("returns the candidate when there is no previous destination", () => {
    const result = applyMagnetHysteresis(input(inv(1, 1, 100, 100), null, free(95, 95)));
    expect(result.destination).toEqual(inv(1, 1, 100, 100));
    expect(result.switched).toBe(false);
  });

  it("returns the candidate when the candidate is the same as the previous destination", () => {
    const result = applyMagnetHysteresis(input(inv(1, 1, 100, 100), inv(1, 1, 100, 100), free(95, 95)));
    expect(result.destination).toEqual(inv(1, 1, 100, 100));
    expect(result.switched).toBe(false);
  });

  it("sticks with the previous destination when the free rect is closer to it than to the candidate", () => {
    const result = applyMagnetHysteresis(input(inv(2, 1, 200, 100), inv(1, 1, 100, 100), free(95, 95)));
    expect(result.destination).toEqual(inv(1, 1, 100, 100));
    expect(result.switched).toBe(true);
  });

  it("switches to the candidate when it is much closer than the previous destination", () => {
    const result = applyMagnetHysteresis(input(inv(1, 1, 100, 100), inv(2, 1, 200, 1000), free(95, 95)));
    expect(result.destination).toEqual(inv(1, 1, 100, 100));
    expect(result.switched).toBe(false);
  });

  it("returns null when both candidate and previous destination are null", () => {
    const result = applyMagnetHysteresis(input(null, null, free(0, 0)));
    expect(result.destination).toBeNull();
    expect(result.switched).toBe(false);
  });
});
