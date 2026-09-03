import { describe, expect, it } from "vitest";
import { chunkIntoRows } from "@/features/alchemy/meta/talents/talent-layout";
import {
  pickerFillerCount,
  pickerPageSlice,
  PICKER_PAGE_SIZE,
} from "@/features/alchemy/meta/screens/armory/paged-picker-grid";

describe("chunkIntoRows", () => {
  it("chunks by fixed size", () => {
    expect(chunkIntoRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("chunks by explicit sizes", () => {
    expect(chunkIntoRows(["a", "b", "c", "d"], [1, 2, 3])).toEqual([["a"], ["b", "c"], ["d"]]);
  });
});

describe("picker paging helpers", () => {
  it("slices pages at the shared page size", () => {
    const items = Array.from({ length: PICKER_PAGE_SIZE + 2 }, (_, i) => i);
    expect(pickerPageSlice(items, 0)).toHaveLength(PICKER_PAGE_SIZE);
    expect(pickerPageSlice(items, 1)).toHaveLength(2);
  });

  it("counts fillers to complete the grid", () => {
    expect(pickerFillerCount(PICKER_PAGE_SIZE)).toBe(0);
    expect(pickerFillerCount(2)).toBe(PICKER_PAGE_SIZE - 2);
  });
});
