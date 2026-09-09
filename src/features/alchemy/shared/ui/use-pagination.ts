import { useEffect, useRef, useState } from "react";
import { anchoredPage, getPagination } from "./pagination";

export function usePagination(itemCount: number, pageSize: number, resetKey?: unknown, selectedIndex = -1) {
  const [state, setState] = useState({ resetKey, pageSize, page: 0 });
  const resetChanged = !Object.is(state.resetKey, resetKey);
  const sizeChanged = state.pageSize !== pageSize;
  const candidatePage = resetChanged
    ? 0
    : sizeChanged
      ? anchoredPage(state.page, state.pageSize, pageSize, itemCount, selectedIndex)
      : state.page;
  const pagination = getPagination(itemCount, candidatePage, pageSize);

  if (resetChanged || sizeChanged || state.page !== pagination.page) {
    setState({ resetKey, pageSize, page: pagination.page });
  }

  const setPage = (next: number | ((prev: number) => number)) => {
    setState((current) => {
      const resolved = typeof next === "function" ? next(current.page) : next;
      const bounded = getPagination(itemCount, resolved, pageSize).page;
      return { resetKey, pageSize, page: bounded };
    });
  };

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
  const [state, setState] = useState({ context, externalPage, page: externalPage, pageSize });
  const contextChanged = !Object.is(state.context, context);
  const externalChanged = state.externalPage !== externalPage;
  const sizeChanged = state.pageSize !== pageSize;

  const candidatePage =
    contextChanged || externalChanged
      ? externalPage
      : sizeChanged
        ? anchoredPage(state.page, state.pageSize, pageSize, itemCount, selectedIndex)
        : state.page;
  const pagination = getPagination(itemCount, candidatePage, pageSize);
  const { page } = pagination;

  if (contextChanged || externalChanged || sizeChanged || state.page !== page) {
    setState({ context, externalPage, page, pageSize });
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
    ) {
      return;
    }
    notified.current = { context, externalPage, page };
    onPageChange(page);
  }, [context, externalPage, page, onPageChange]);

  return pagination;
}
