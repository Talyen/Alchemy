import { paginateRows } from "./pagination";
import { usePagination } from "./use-pagination";

export function usePaginatedRows<T>(items: readonly T[], pageSize: number, columns: number, resetKey?: unknown) {
  const { page, setPage } = usePagination(items.length, pageSize, resetKey);
  return { setPage, ...paginateRows(items, page, pageSize, columns) };
}
