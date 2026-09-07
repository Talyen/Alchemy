import { paginateRows } from "@/features/alchemy/shared/ui/pagination";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePaginatedRows } from "@/features/alchemy/shared/ui/use-paginated-rows";

describe("usePaginatedRows", () => {
  it("resets to the first page when resetKey changes", () => {
    const items = [0, 1, 2, 3, 4];
    const { result, rerender } = renderHook(({ resetKey }) => usePaginatedRows(items, 2, 2, resetKey), {
      initialProps: { resetKey: true },
    });

    act(() => {
      result.current.setPage(1);
    });
    expect(result.current.page).toBe(1);

    rerender({ resetKey: false });
    expect(result.current.page).toBe(0);
  });

  it("keeps the page when resetKey is omitted", () => {
    const items = [0, 1, 2, 3, 4];
    const { result, rerender } = renderHook(() => usePaginatedRows(items, 2, 2));

    act(() => {
      result.current.setPage(1);
    });
    rerender();
    expect(result.current.page).toBe(1);
  });
});

describe("pagination bounds", () => {
  it("retains the clamped page when a list grows again", () => {
    const items = Array.from({ length: 30 }, (_, index) => index);
    const { result, rerender } = renderHook(({ count }) => usePaginatedRows(items.slice(0, count), 10, 5), {
      initialProps: { count: 30 },
    });
    act(() => result.current.setPage(2));
    rerender({ count: 10 });
    expect(result.current.page).toBe(0);
    rerender({ count: 30 });
    expect(result.current.page).toBe(0);
    act(() => result.current.setPage((page) => page + 1));
    expect(result.current.pageItems).toEqual(items.slice(10, 20));
  });

  it("bounds negative pages and handles zero capacity for empty choices", () => {
    expect(paginateRows([0, 1, 2, 3], -1, 2, 2)).toMatchObject({ page: 0, pageItems: [0, 1] });
    expect(paginateRows([], 0, 0, 4)).toEqual({ page: 0, totalPages: 1, pageItems: [], rows: [] });
  });
});
