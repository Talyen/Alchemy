import { StrictMode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { anchoredPage, getPagination, paginateRows } from "@/features/alchemy/shared/ui/pagination";
import { useControlledPagination, usePagination } from "@/features/alchemy/shared/ui/use-pagination";
import { usePaginatedRows } from "@/features/alchemy/shared/ui/use-paginated-rows";

afterEach(cleanup);

it("keeps a partial last page and bounds empty or invalid capacities", () => {
  expect(paginateRows([0, 1, 2, 3, 4], 99, 3, 2)).toEqual({
    page: 1,
    totalPages: 2,
    pageItems: [3, 4],
    rows: [[3, 4]],
  });
  expect(getPagination(0, -1, 0)).toEqual({ page: 0, totalPages: 1, pageSize: 1 });
  expect(paginateRows([0, 1], 0, -1, 0).rows).toEqual([[0]]);
  expect(anchoredPage(4, 8, 10, 12)).toBe(1);
  expect(anchoredPage(1, 8, 10, 40, 23)).toBe(2);
  expect(anchoredPage(1, 8, 10, 40, 99)).toBe(0);
});

it("never drops or duplicates entries for fractional and non-finite pagination inputs", () => {
  const items = [0, 1, 2, 3, 4];
  const first = paginateRows(items, NaN, 2.9, 1.5);
  const second = paginateRows(items, 1.9, 2.9, 1.5);
  const third = paginateRows(items, 2, 2.9, Infinity);
  expect([first, second, third].flatMap(({ rows }) => rows.flat())).toEqual(items);
  expect(getPagination(Infinity, Infinity, NaN)).toEqual({ page: 0, totalPages: 1, pageSize: 1 });
  expect(paginateRows(items, 0, Infinity, NaN).rows).toEqual([[0]]);
  expect(anchoredPage(2, 2.9, 1.9, 20)).toBe(4);
  expect(anchoredPage(2, 2, Infinity, 20, 7)).toBe(7);
});

it("recovers from non-finite hook inputs without an endless render loop", () => {
  const notify = vi.fn();
  const { result, rerender } = renderHook(
    ({ size }) => ({
      local: usePagination(5, size),
      controlled: useControlledPagination({ page: NaN, pageSize: size, itemCount: 5, onPageChange: notify }),
    }),
    { initialProps: { size: NaN }, wrapper: StrictMode },
  );
  expect(result.current.local.page).toBe(0);
  expect(result.current.controlled.page).toBe(0);
  rerender({ size: 2 });
  expect(result.current.local.totalPages).toBe(3);
  expect(result.current.controlled.totalPages).toBe(3);
  expect(notify).toHaveBeenCalledExactlyOnceWith(0);
});

it("retains a selected entry on resize but resets when the picker context changes", () => {
  const { result, rerender } = renderHook(({ size, context }) => usePagination(40, size, context, 23), {
    initialProps: { size: 8, context: "weapon" },
  });
  act(() => result.current.setPage(2));
  rerender({ size: 6, context: "weapon" });
  expect(result.current.page).toBe(3);
  rerender({ size: 10, context: "armor" });
  expect(result.current.page).toBe(0);
});

it("reports automatic corrections once with unstable callbacks and StrictMode", () => {
  const notify = vi.fn();
  const { result, rerender } = renderHook(
    ({ page, size }) =>
      useControlledPagination({
        page,
        pageSize: size,
        itemCount: 40,
        onPageChange: (nextPage) => notify(nextPage),
      }),
    { initialProps: { page: 2, size: 8 }, wrapper: StrictMode },
  );
  rerender({ page: 2, size: 10 });
  expect(result.current.page).toBe(1);
  expect(notify).toHaveBeenCalledExactlyOnceWith(1);
  rerender({ page: 2, size: 10 });
  expect(notify).toHaveBeenCalledTimes(1);
  rerender({ page: 1, size: 10 });
  expect(result.current.page).toBe(1);
  expect(notify).toHaveBeenCalledTimes(1);
  rerender({ page: 0, size: 6 });
  expect(result.current.page).toBe(0);
  expect(notify).toHaveBeenCalledTimes(1);
});

it("does not revive a removed controlled page even before the parent acknowledges the correction", () => {
  const notify = vi.fn();
  const { result, rerender } = renderHook(
    ({ count }) => useControlledPagination({ page: 2, pageSize: 10, itemCount: count, onPageChange: notify }),
    { initialProps: { count: 30 } },
  );
  rerender({ count: 10 });
  expect(result.current.page).toBe(0);
  rerender({ count: 30 });
  expect(result.current.page).toBe(0);
  expect(notify).toHaveBeenCalledExactlyOnceWith(0);
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

  it("keeps the controlled picker selection visible across resizes and honors a new context", () => {
    const notify = vi.fn();
    const { result, rerender } = renderHook(
      ({ size, context }) =>
        useControlledPagination({
          page: 2,
          pageSize: size,
          itemCount: 40,
          selectedIndex: 23,
          context,
          onPageChange: notify,
        }),
      { initialProps: { size: 8, context: "gear" } },
    );
    rerender({ size: 6, context: "gear" });
    expect(result.current.page).toBe(3);
    expect(notify).toHaveBeenCalledExactlyOnceWith(3);
    rerender({ size: 10, context: "trinkets" });
    expect(result.current.page).toBe(2);
    expect(notify).toHaveBeenCalledTimes(1);
  });
});
