import { describe, expect, it } from "vitest";
import {
  areHexesAdjacent,
  hexAt,
  hexKey,
  hexNeighbors,
  hexRadius,
  isHexInBounds,
  projectedHalfColumn,
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
});
