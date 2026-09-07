import { describe, expect, it } from "vitest";
import { chunkIntoRows } from "@/lib/game-data";
describe("chunkIntoRows", () => {
  it("chunks by fixed size", () => {
    expect(chunkIntoRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("chunks by explicit sizes", () => {
    expect(chunkIntoRows(["a", "b", "c", "d"], [1, 2, 3])).toEqual([["a"], ["b", "c"], ["d"]]);
  });
});
