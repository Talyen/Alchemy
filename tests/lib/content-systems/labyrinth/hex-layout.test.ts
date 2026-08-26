import { describe, expect, it } from "vitest";
import { generateFloorLayout, isValidFloorLayout } from "@/lib/content-systems/labyrinth/hex-layout";
import { areHexesAdjacent, isHexInBounds } from "@/lib/content-systems/labyrinth/hex-grid";
import { createSeededRng } from "@/lib/utils";

describe("generateFloorLayout", () => {
  it("returns a bounded connected layout with leaf entry and boss", () => {
    for (const seed of [1, 4, 9, 16, 25, 36, 42, 64]) {
      const layout = generateFloorLayout(9, createSeededRng(seed));
      expect(layout).toHaveLength(9);
      expect(isValidFloorLayout(layout, false) || isValidFloorLayout(layout, true)).toBe(true);
      for (const position of layout) {
        expect(isHexInBounds(position)).toBe(true);
      }
    }
  });

  it("is deterministic per seed", () => {
    expect(generateFloorLayout(10, createSeededRng(7))).toEqual(generateFloorLayout(10, createSeededRng(7)));
  });

  it("keeps entry and boss as hex leaves", () => {
    const layout = generateFloorLayout(11, createSeededRng(3));
    const degree = (index: number) =>
      layout.reduce((count, target, targetIndex) => {
        if (targetIndex === index) return count;
        return count + (areHexesAdjacent(layout[index]!, target) ? 1 : 0);
      }, 0);
    expect(degree(0)).toBe(1);
    expect(degree(layout.length - 1)).toBe(1);
  });

  it("keeps fallback layouts valid trees", () => {
    for (const count of [9, 10, 11, 12]) {
      const layout = generateFloorLayout(count, () => 0.99);
      expect(isValidFloorLayout(layout, false) || isValidFloorLayout(layout, true)).toBe(true);
    }
  });
});
