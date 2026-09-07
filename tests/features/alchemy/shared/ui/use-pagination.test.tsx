import { StrictMode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { anchoredPage, getPagination, paginateRows } from "@/features/alchemy/shared/ui/pagination";
import { useControlledPagination, usePagination } from "@/features/alchemy/shared/ui/use-pagination";

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
