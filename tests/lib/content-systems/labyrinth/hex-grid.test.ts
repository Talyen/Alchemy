import { describe, expect, it } from "vitest";
import {
  areHexesAdjacent,
  compareHexPositions,
  hexAt,
  hexKey,
  hexMetrics,
  hexNeighbors,
  hexRadius,
  isHexInBounds,
  projectedHalfColumn,
  projectedX,
} from "@/lib/content-systems/labyrinth/hex-grid";

describe("hex grid", () => {
  it("treats axial neighbors as adjacent and non-neighbors as not", () => {
    const origin = { row: 0, col: 0 };
    expect(areHexesAdjacent(origin, { row: 1, col: 0 })).toBe(true);
    expect(areHexesAdjacent(origin, { row: 1, col: -1 })).toBe(true);
    expect(areHexesAdjacent(origin, { row: 1, col: 1 })).toBe(false);
    expect(hexNeighbors(origin).every((neighbor) => areHexesAdjacent(origin, neighbor))).toBe(true);
  });

  it("keys and bounds stay stable", () => {
    expect(hexKey({ row: 2, col: -1 })).toBe("2,-1");
    expect(projectedHalfColumn({ row: 2, col: 0 })).toBe(2);
    expect(isHexInBounds({ row: 0, col: 0 })).toBe(true);
    expect(isHexInBounds({ row: 0, col: 3 })).toBe(true);
    expect(isHexInBounds({ row: 0, col: 4 })).toBe(false);
    expect(isHexInBounds({ row: 5, col: 0 })).toBe(true);
    expect(isHexInBounds(hexAt(8, 0))).toBe(true);
    expect(isHexInBounds(hexAt(9, 0))).toBe(false);
    expect(hexRadius(400)).toBeGreaterThan(0);
  });

  it("calculates hex metrics, projections, and position sorting correctly", () => {
    const metrics = hexMetrics(20);
    expect(metrics.radius).toBe(20);
    expect(metrics.width).toBeCloseTo(20 * Math.sqrt(3));
    expect(metrics.height).toBe(40);
    expect(metrics.verticalStep).toBe(30);
    expect(projectedX({ row: 0, col: 1 }, 20)).toBeCloseTo(20 * Math.sqrt(3));
    expect(projectedX({ row: 2, col: 0 }, 20)).toBeCloseTo(20 * Math.sqrt(3));
    expect(compareHexPositions({ row: 0, col: 0 }, { row: 1, col: 0 })).toBeLessThan(0);
    expect(compareHexPositions({ row: 1, col: 0 }, { row: 1, col: 1 })).toBeLessThan(0);
    expect(compareHexPositions({ row: 1, col: 1 }, { row: 1, col: 1 })).toBe(0);
  });
});
