import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useArmoryPickerPage } from "@/features/alchemy/meta/screens/armory/paged-picker-grid";

describe("useArmoryPickerPage", () => {
  it("slices the current page and counts fillers", () => {
    const items = Array.from({ length: 8 }, (_, index) => `item-${index}`);
    const { result } = renderHook(() => useArmoryPickerPage("knight:main-hand", items));
    expect(result.current.pageItems).toEqual(items.slice(0, 6));
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
    expect(result.current.pageItems).toEqual(items.slice(6));
    rerender({ context: "rogue:main-hand" });
    expect(result.current.pageItems).toEqual(items.slice(0, 6));
  });

  it("keeps the clamped Armory page after items are added", () => {
    const items = Array.from({ length: 20 }, (_, index) => index);
    const { result, rerender } = renderHook(
      ({ count }) => useArmoryPickerPage("knight:main-hand", items.slice(0, count)),
      {
        initialProps: { count: 20 },
      },
    );
    act(() => result.current.onPageChange(2));
    rerender({ count: 4 });
    expect(result.current.safePage).toBe(0);
    rerender({ count: 20 });
    expect(result.current.safePage).toBe(0);
  });
});
