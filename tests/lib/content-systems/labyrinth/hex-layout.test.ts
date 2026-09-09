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
  hexVisualColumn,
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
  it("validates every five-row snake with only local loops and optional pockets", () => {
    for (const count of [12, 13, 14]) {
      const variants = new Set<string>();
      const cycles = new Set<number>();
      for (let variant = 0; variant < 6; variant += 1) {
        const layout = generateFloorLayout(count, () => variant / 6);
        expect(layout).toHaveLength(count);
        assertLayoutConstraints(layout);
        expect(Math.max(...layout.map((p) => p.row))).toBe(4);
        expect(Math.max(...layout.map(hexVisualColumn)) - Math.min(...layout.map(hexVisualColumn))).toBe(4);
        const distances = distancesFromEntry(layout);
        const route = [layout.length - 1];
        while (route[0] !== 0) {
          const current = route[0]!;
          route.unshift(
            layout.findIndex(
              (position, index) =>
                distances[index] === distances[current]! - 1 && areHexesAdjacent(position, layout[current]!),
            ),
          );
        }
        const horizontalRuns: number[] = [];
        for (let step = 1; step < route.length; step += 1) {
          const from = layout[route[step - 1]!]!;
          const to = layout[route[step]!]!;
          expect(to.row).toBeGreaterThanOrEqual(from.row);
          if (from.row === to.row) {
            const direction = Math.sign(to.col - from.col);
            if (direction !== horizontalRuns.at(-1)) horizontalRuns.push(direction);
          }
        }
        expect(horizontalRuns).toHaveLength(3);
        const offRoute = layout.map((_, index) => index).filter((index) => !route.includes(index));
        expect(offRoute.length).toBeGreaterThan(0);
        for (const index of offRoute) {
          const neighbors = offRoute.filter((other) => areHexesAdjacent(layout[index]!, layout[other]!));
          expect(neighbors.length).toBeLessThanOrEqual(1);
          const pocket = [index, ...neighbors];
          const attachments = route.flatMap((main, order) =>
            pocket.some((side) => areHexesAdjacent(layout[main]!, layout[side]!)) ? [order] : [],
          );
          expect(attachments.length).toBeGreaterThan(0);
          expect(Math.max(...attachments) - Math.min(...attachments)).toBeLessThanOrEqual(1);
        }
        variants.add(JSON.stringify(layout));
        cycles.add(floorLayoutCycleCount(layout));
      }
      expect(variants.size).toBe(6);
      expect(cycles).toEqual(new Set([0, 1]));
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
