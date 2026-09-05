import { describe, expect, it } from "vitest";
import {
  floorLayoutCycleCount,
  generateFloorLayout,
  hexDegree,
  isValidFloorLayout,
} from "@/lib/content-systems/labyrinth/hex-layout";
import {
  LABYRINTH_HEX,
  areHexesAdjacent,
  hexKey,
  isHexInGenerationBounds,
} from "@/lib/content-systems/labyrinth/hex-grid";
import { createSeededRng } from "@/lib/utils";
import type { LabyrinthGridPosition } from "@/lib/content-systems/types";

function distancesFromEntry(layout: LabyrinthGridPosition[]) {
  const distances = layout.map(() => Infinity);
  distances[0] = 0;
  const frontier = [0];
  for (const index of frontier) {
    layout.forEach((position, next) => {
      if (distances[next] !== Infinity || !areHexesAdjacent(layout[index]!, position)) return;
      distances[next] = distances[index]! + 1;
      frontier.push(next);
    });
  }
  return distances;
}

function assertLayoutConstraints(layout: LabyrinthGridPosition[]) {
  expect(isValidFloorLayout(layout)).toBe(true);
  expect(hexDegree(layout, 0)).toBe(1);
  expect(hexDegree(layout, layout.length - 1)).toBe(1);
  expect(new Set(layout.map(hexKey)).size).toBe(layout.length);
  for (const [index, position] of layout.entries()) {
    expect(isHexInGenerationBounds(position)).toBe(true);
    expect(hexDegree(layout, index)).toBeLessThanOrEqual(LABYRINTH_HEX.maxNodeDegree);
  }
  const distances = distancesFromEntry(layout);
  expect(distances.every(Number.isFinite)).toBe(true);
  expect(distances.at(-1)).toBe(Math.max(...distances));
}

describe("generateFloorLayout", () => {
  it("validates every compact template, including loops and optional dead ends", () => {
    for (const count of [12, 13, 14]) {
      const variants = new Set<string>();
      const cycles = new Set<number>();
      const leaves = new Set<number>();
      for (let variant = 0; variant < 6; variant += 1) {
        const layout = generateFloorLayout(count, () => variant / 6);
        expect(layout).toHaveLength(count);
        assertLayoutConstraints(layout);
        expect(Math.max(...layout.map((p) => p.row))).toBeLessThanOrEqual(6);
        variants.add(JSON.stringify(layout));
        cycles.add(floorLayoutCycleCount(layout));
        leaves.add(layout.filter((_, i) => hexDegree(layout, i) === 1).length);
      }
      expect(variants.size).toBe(6);
      expect(cycles).toEqual(new Set([1, 2, 3]));
      expect(leaves).toEqual(new Set([2, 3, 4]));
    }
  });

  it("preserves constraints across seeds and returns fresh positions", () => {
    for (let seed = 0; seed < 100; seed += 1) {
      for (const count of [12, 13, 14]) {
        const first = generateFloorLayout(count, createSeededRng(seed));
        const second = generateFloorLayout(count, createSeededRng(seed));
        expect(first).toEqual(second);
        expect(first[0]).not.toBe(second[0]);
        assertLayoutConstraints(first);
      }
    }
  });

  it("clamps out-of-range counts onto production floor sizes", () => {
    expect(generateFloorLayout(9, () => 0)).toHaveLength(12);
    expect(generateFloorLayout(20, () => 0.99)).toHaveLength(14);
  });

  it("rejects a terminal boss that is closer than an optional chamber", () => {
    const layout = generateFloorLayout(12, () => 2 / 6);
    const distances = distancesFromEntry(layout);
    const closerLeaf = layout.findIndex(
      (_, index) => index > 0 && hexDegree(layout, index) === 1 && distances[index]! < distances.at(-1)!,
    );
    expect(closerLeaf).toBeGreaterThan(0);
    const invalid = [...layout];
    [invalid[closerLeaf], invalid[invalid.length - 1]] = [invalid[invalid.length - 1]!, invalid[closerLeaf]!];
    expect(isValidFloorLayout(invalid)).toBe(false);
  });

  it("rejects duplicate cells and disconnected chambers", () => {
    const layout = generateFloorLayout(12, () => 0);
    expect(isValidFloorLayout([...layout, layout[0]!])).toBe(false);
    expect(isValidFloorLayout([...layout, { row: 8, col: -4 }])).toBe(false);
  });
});
