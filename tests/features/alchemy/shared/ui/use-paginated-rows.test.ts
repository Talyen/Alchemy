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
