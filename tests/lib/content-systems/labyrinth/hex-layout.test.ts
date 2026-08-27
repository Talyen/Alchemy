import { describe, expect, it } from "vitest";
import {
  floorLayoutCycleCount,
  generateFloorLayout,
  hexDegree,
  isValidFloorLayout,
} from "@/lib/content-systems/labyrinth/hex-layout";
import {
  LABYRINTH_HEX,
  hexKey,
  hexVisualColumn,
  isHexInBounds,
  isHexInGenerationBounds,
} from "@/lib/content-systems/labyrinth/hex-grid";
import { createSeededRng } from "@/lib/utils";
import type { LabyrinthGridPosition } from "@/lib/content-systems/types";

const FLOOR_COUNTS = [12, 13, 14] as const;

function assertLayoutConstraints(layout: LabyrinthGridPosition[]) {
  expect(isValidFloorLayout(layout)).toBe(true);
  expect(hexDegree(layout, 0)).toBe(1);
  expect(hexDegree(layout, layout.length - 1)).toBe(1);
  const leaves = layout.filter((_, index) => hexDegree(layout, index) === 1);
  expect(leaves).toHaveLength(2);
  const seen = new Set<string>();
  for (const [index, position] of layout.entries()) {
    expect(isHexInGenerationBounds(position)).toBe(true);
    expect(isHexInBounds(position)).toBe(true);
    expect(hexDegree(layout, index)).toBeLessThanOrEqual(LABYRINTH_HEX.maxNodeDegree);
    const key = hexKey(position);
    expect(seen.has(key)).toBe(false);
    seen.add(key);
  }
  const visuals = layout.map(hexVisualColumn);
  expect(Math.max(...visuals) - Math.min(...visuals)).toBeGreaterThanOrEqual(2);
}

describe("generateFloorLayout", () => {
  it("returns a 3-wide branching floor with leaf entry and boss", () => {
    for (const seed of [1, 4, 9, 16, 25, 36, 42, 64]) {
      for (const count of FLOOR_COUNTS) {
        const layout = generateFloorLayout(count, createSeededRng(seed + count));
        expect(layout).toHaveLength(count);
        assertLayoutConstraints(layout);
      }
    }
  });

  it("is deterministic per seed", () => {
    expect(generateFloorLayout(12, createSeededRng(7))).toEqual(generateFloorLayout(12, createSeededRng(7)));
  });

  it("keeps only entry and boss as leaves", () => {
    const layout = generateFloorLayout(13, createSeededRng(3));
    const leaves = layout.filter((_, index) => hexDegree(layout, index) === 1);
    expect(leaves).toHaveLength(2);
  });

  it("clamps out-of-range counts onto the production floor size", () => {
    const layout = generateFloorLayout(9, () => 0.99);
    expect(layout.length).toBeGreaterThanOrEqual(LABYRINTH_HEX.minNodesPerFloor);
    expect(layout.length).toBeLessThanOrEqual(LABYRINTH_HEX.maxNodesPerFloor);
    expect(isValidFloorLayout(layout)).toBe(true);
  });

  it("selects two- and three-route variants via RNG", () => {
    for (const count of FLOOR_COUNTS) {
      const twoRoute = generateFloorLayout(count, () => 0);
      const threeRoute = generateFloorLayout(count, () => 0.99);
      expect(twoRoute).toHaveLength(count);
      expect(threeRoute).toHaveLength(count);
      assertLayoutConstraints(twoRoute);
      assertLayoutConstraints(threeRoute);
      expect(floorLayoutCycleCount(twoRoute)).toBe(1);
      expect(floorLayoutCycleCount(threeRoute)).toBe(2);
      expect(twoRoute).not.toEqual(threeRoute);
    }
  });

  it("reaches both variants across seeds", () => {
    for (const count of FLOOR_COUNTS) {
      const cycles = new Set<number>();
      for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) {
        const layout = generateFloorLayout(count, createSeededRng(seed));
        expect(layout).toHaveLength(count);
        assertLayoutConstraints(layout);
        cycles.add(floorLayoutCycleCount(layout));
      }
      expect(cycles).toEqual(new Set([1, 2]));
    }
  });
});
