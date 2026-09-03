import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  PICKER_PAGE_SIZE,
  pickerFillerCount,
  pickerPageSlice,
  useArmoryPickerPage,
} from "@/features/alchemy/meta/screens/armory/paged-picker-grid";

describe("pickerPageSlice", () => {
  it("pages items from the start", () => {
    const items = Array.from({ length: 8 }, (_, index) => index);
    expect(pickerPageSlice(items, 0)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(pickerPageSlice(items, 1)).toEqual([6, 7]);
  });

  it("returns an empty page past the end", () => {
    expect(pickerPageSlice([1, 2, 3], 2)).toEqual([]);
  });
});

describe("pickerFillerCount", () => {
  it("fills a partial page up to the page size", () => {
    expect(pickerFillerCount(4)).toBe(PICKER_PAGE_SIZE - 4);
  });

  it("needs no fillers for a full page", () => {
    expect(pickerFillerCount(PICKER_PAGE_SIZE)).toBe(0);
  });
});

describe("useArmoryPickerPage", () => {
  it("slices the current page and counts fillers", () => {
    const items = Array.from({ length: 8 }, (_, index) => `item-${index}`);
    const { result } = renderHook(() => useArmoryPickerPage("knight:main-hand", items));
    expect(result.current.pageItems).toEqual(items.slice(0, PICKER_PAGE_SIZE));
    expect(result.current.fillerCount).toBe(0);
    expect(result.current.totalPages).toBe(2);
  });

  it("resets to the first page when the context changes", () => {
    const items = Array.from({ length: 8 }, (_, index) => `item-${index}`);
    const { result, rerender } = renderHook(({ context }: { context: string }) => useArmoryPickerPage(context, items), {
      initialProps: { context: "knight:main-hand" },
    });
    act(() => {
      result.current.onPageChange(1);
    });
    expect(result.current.pageItems).toEqual(items.slice(PICKER_PAGE_SIZE));
    rerender({ context: "rogue:main-hand" });
    expect(result.current.pageItems).toEqual(items.slice(0, PICKER_PAGE_SIZE));
  });
});
