import { useEffect, useRef, useState } from "react";
import { anchoredPage, getPagination } from "./pagination";

export function usePagination(itemCount: number, pageSize: number, resetKey?: unknown, selectedIndex = -1) {
  const [page, setPage] = useState(0);
  const [previous, setPrevious] = useState({ resetKey, pageSize });
  const nextPage = !Object.is(previous.resetKey, resetKey)
    ? 0
    : previous.pageSize !== pageSize
      ? anchoredPage(page, previous.pageSize, pageSize, itemCount, selectedIndex)
      : page;
  const pagination = getPagination(itemCount, nextPage, pageSize);
  if (!Object.is(previous.resetKey, resetKey) || previous.pageSize !== pageSize) {
    setPrevious({ resetKey, pageSize });
  }
  if (page !== pagination.page) setPage(pagination.page);
  return { ...pagination, setPage };
}

export function useControlledPagination({
  page: externalPage,
  pageSize,
  itemCount,
  onPageChange,
  context,
  selectedIndex = -1,
}: {
  page: number;
  pageSize: number;
  itemCount: number;
  onPageChange: (page: number) => void;
  context?: unknown;
  selectedIndex?: number;
}) {
  const [previous, setPrevious] = useState({ context, externalPage, page: externalPage, pageSize });
  const nextPage =
    !Object.is(previous.context, context) || previous.externalPage !== externalPage
      ? externalPage
      : previous.pageSize !== pageSize
        ? anchoredPage(previous.page, previous.pageSize, pageSize, itemCount, selectedIndex)
        : previous.page;
  const pagination = getPagination(itemCount, nextPage, pageSize);
  const { page } = pagination;
  if (
    !Object.is(previous.context, context) ||
    previous.externalPage !== externalPage ||
    previous.pageSize !== pageSize ||
    previous.page !== page
  ) {
    setPrevious({ context, externalPage, page, pageSize });
  }
  const notified = useRef<{ context: unknown; externalPage: number; page: number } | null>(null);
  useEffect(() => {
    if (page === externalPage) {
      notified.current = null;
      return;
    }
    if (
      Object.is(notified.current?.context, context) &&
      notified.current?.externalPage === externalPage &&
      notified.current?.page === page
    )
      return;
    notified.current = { context, externalPage, page };
    onPageChange(page);
  }, [context, externalPage, page, onPageChange]);
  return pagination;
}
