// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useInventoryScrollDrag } from "@/features/alchemy/meta/screens/armory/use-inventory-scroll-drag";

function createBoard() {
  const board = document.createElement("div");
  let captured = false;
  const setPointerCapture = vi.fn(() => {
    captured = true;
  });
  const releasePointerCapture = vi.fn(() => {
    captured = false;
  });
  const hasPointerCapture = vi.fn(() => captured);

  Object.assign(board, { setPointerCapture, releasePointerCapture, hasPointerCapture });

  return { board, setPointerCapture, releasePointerCapture, hasPointerCapture };
}

function createPointerEvent(
  board: HTMLDivElement,
  overrides: Partial<Pick<React.PointerEvent<HTMLDivElement>, "clientY" | "pointerId" | "pointerType" | "button">> = {},
) {
  return {
    currentTarget: board,
    target: board,
    clientY: 100,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    ...overrides,
  } as unknown as React.PointerEvent<HTMLDivElement>;
}

describe("useInventoryScrollDrag", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("captures valid board pointers immediately and releases a short cancel", () => {
    const { board, setPointerCapture, releasePointerCapture } = createBoard();
    const { result } = renderHook(() =>
      useInventoryScrollDrag({ canScroll: true, salvageMode: false, activeCurrencyId: null }),
    );

    act(() => {
      result.current.handlePointerDown(createPointerEvent(board));
    });

    expect(setPointerCapture).toHaveBeenCalledWith(1);
    expect(result.current.dragging).toBe(true);

    act(() => {
      result.current.handlePointerCancel(createPointerEvent(board));
    });

    expect(releasePointerCapture).toHaveBeenCalledWith(1);
    expect(result.current.dragging).toBe(false);
    expect(result.current.dragSequence).toBe(0);
    expect(result.current.suppressClickRef.current).toBe(false);
  });

  it("clears the suppression timeout when unmounted before it fires", () => {
    vi.useFakeTimers();
    const { board } = createBoard();
    const { result, unmount } = renderHook(() =>
      useInventoryScrollDrag({ canScroll: true, salvageMode: false, activeCurrencyId: null }),
    );

    act(() => {
      result.current.handlePointerDown(createPointerEvent(board));
      result.current.handlePointerMove(createPointerEvent(board, { clientY: 90 }));
      result.current.handlePointerUp(createPointerEvent(board, { clientY: 90 }));
    });

    expect(result.current.dragSequence).toBe(1);
    expect(result.current.suppressClickRef.current).toBe(true);
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current.suppressClickRef.current).toBe(true);
  });
});
