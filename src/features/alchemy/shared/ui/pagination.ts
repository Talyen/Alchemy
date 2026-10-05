import { clamp } from "@/lib/math";

function normalizedCapacity(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}

export function getPagination(itemCount: number, page: number, pageSize: number) {
  const size = normalizedCapacity(pageSize);
  const count = Number.isFinite(itemCount) ? Math.max(0, Math.floor(itemCount)) : 0;
  const totalPages = Math.max(1, Math.ceil(count / size));
  const candidate = Number.isFinite(page) ? Math.floor(page) : 0;
  return { page: clamp(candidate, 0, totalPages - 1), totalPages, pageSize: size };
}

export function anchoredPage(
  previousPage: number,
  previousSize: number,
  pageSize: number,
  itemCount: number,
  selectedIndex = -1,
) {
  const size = normalizedCapacity(pageSize);
  const anchor =
    selectedIndex >= 0 && selectedIndex < itemCount ? selectedIndex : previousPage * normalizedCapacity(previousSize);
  return getPagination(itemCount, Math.floor(anchor / size), size).page;
}

export function paginateRows<T>(items: readonly T[], page: number, pageSize: number, columns: number) {
  const { page: safePage, totalPages, pageSize: size } = getPagination(items.length, page, pageSize);
  const pageItems = items.slice(safePage * size, (safePage + 1) * size);
  const columnCount = normalizedCapacity(columns);
  const rows = Array.from({ length: Math.ceil(pageItems.length / columnCount) }, (_, rowIndex) =>
    pageItems.slice(rowIndex * columnCount, (rowIndex + 1) * columnCount),
  );
  return { page: safePage, totalPages, pageItems, rows };
}
