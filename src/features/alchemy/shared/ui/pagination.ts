export function getPagination(itemCount: number, page: number, pageSize: number) {
  const size = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(itemCount / size));
  return { page: Math.max(0, Math.min(page, totalPages - 1)), totalPages, pageSize: size };
}

export function anchoredPage(
  previousPage: number,
  previousSize: number,
  pageSize: number,
  itemCount: number,
  selectedIndex = -1,
) {
  const anchor = selectedIndex >= 0 && selectedIndex < itemCount ? selectedIndex : previousPage * previousSize;
  return getPagination(itemCount, Math.floor(anchor / Math.max(1, pageSize)), pageSize).page;
}

export function paginateRows<T>(items: readonly T[], page: number, pageSize: number, columns: number) {
  const { page: safePage, totalPages, pageSize: size } = getPagination(items.length, page, pageSize);
  const pageItems = items.slice(safePage * size, (safePage + 1) * size);
  const columnCount = Math.max(1, columns);
  const rows = Array.from({ length: Math.ceil(pageItems.length / columnCount) }, (_, rowIndex) =>
    pageItems.slice(rowIndex * columnCount, (rowIndex + 1) * columnCount),
  );
  return { page: safePage, totalPages, pageItems, rows };
}
