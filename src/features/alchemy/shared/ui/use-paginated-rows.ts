import { useState } from "react";

/** Clamp-to-range pagination math plus fixed-size row chunking for centered grids. */
export function paginateRows<T>(items: readonly T[], page: number, pageSize: number, columns: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  // Derived clamp: an out-of-range page renders as the last page without a
  // render-phase state write; callers heal the stored page on navigation.
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = items.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const rows = Array.from({ length: Math.ceil(pageItems.length / columns) }, (_, rowIndex) =>
    pageItems.slice(rowIndex * columns, rowIndex * columns + columns),
  );
  return { page: safePage, totalPages, pageItems, rows };
}

/** Self-owned clamped page state for overlays that keep their own pagination. */
export function usePaginatedRows<T>(items: readonly T[], pageSize: number, columns: number, resetKey?: unknown) {
  const [page, setPage] = useState(0);
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (!Object.is(resetKey, prevResetKey)) {
    setPrevResetKey(resetKey);
    setPage(0);
  }
  return { setPage, ...paginateRows(items, page, pageSize, columns) };
}
