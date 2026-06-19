// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useBoardDrag } from "@/features/alchemy/meta/screens/armory/use-board-drag";
import type { DragRect } from "@/features/alchemy/meta/screens/armory/use-board-drag";

vi.mock("@/lib/audio", () => ({
  playUISound: vi.fn(),
}));

function mockDomRect(partial: Partial<DOMRect>): DOMRect {
  const left = partial.left ?? 0;
  const top = partial.top ?? 0;
  const width = partial.width ?? 0;
  const height = partial.height ?? 0;
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("useBoardDrag", () => {
  it("captures releaseRect on unchanged/reverted drag", () => {
    const onCommit = vi.fn();
    const inventoryBoardRef = { current: null };

    const { result } = renderHook(() =>
      useBoardDrag({
        itemLookup: { id: "item-1" },
        getItemId: (item) => item.id,
        getOrigin: () => ({ kind: "inventory", placement: { col: 0, row: 0 } }),
        getFootprint: () => ({ w: 1, h: 1 }),
        inventoryBoardRef,
        occupiedRows: 0,
        onCommit,
      }),
    );

    // 1. Initial State
    expect(result.current.dragVisual).toBeNull();

    // 2. Begin pointer drag
    const sourceRect: DragRect = { left: 10, top: 20, width: 50, height: 50 };
    act(() => {
      result.current.beginPointer({ id: "item-1" }, sourceRect, { x: 15, y: 25 }, 1);
    });

    // 3. Move pointer to trigger active dragging
    act(() => {
      result.current.movePointer({ x: 30, y: 40 }, 1);
    });

    // 4. Assert active drag properties
    expect(result.current.activeId).toBe("item-1");
    expect(result.current.dragVisual).not.toBeNull();
    
    const activeRect = result.current.dragVisual!.rect;
    // offset: x: 15 - 10 = 5, y: 25 - 20 = 5
    // at pointer (30, 40): left: 30 - 5 = 25, top: 40 - 5 = 35
    expect(activeRect).toEqual({ left: 25, top: 35, width: 50, height: 50 });
    // releaseRect should be undefined while dragging
    expect((result.current.dragVisual as any).releaseRect).toBeUndefined();

    // 5. Finish pointer drag (which reverts because destination is null)
    act(() => {
      result.current.finishPointer({ x: 30, y: 40 }, 1, false);
    });

    // 6. Assert settling and releaseRect capture
    expect(result.current.dragVisual?.settling).toBe(true);
    expect((result.current.dragVisual as any).releaseRect).toEqual({
      left: 25,
      top: 35,
      width: 50,
      height: 50,
    });
  });

  it("captures releaseRect on cancelled drag", () => {
    const onCancel = vi.fn();
    const inventoryBoardRef = { current: null };

    const { result } = renderHook(() =>
      useBoardDrag({
        itemLookup: { id: "item-1" },
        getItemId: (item) => item.id,
        getOrigin: () => ({ kind: "inventory", placement: { col: 0, row: 0 } }),
        getFootprint: () => ({ w: 1, h: 1 }),
        inventoryBoardRef,
        occupiedRows: 0,
        onCommit: vi.fn(),
        onCancel,
      }),
    );

    act(() => {
      result.current.beginPointer({ id: "item-1" }, { left: 10, top: 20, width: 50, height: 50 }, { x: 15, y: 25 }, 1);
    });

    act(() => {
      result.current.movePointer({ x: 35, y: 45 }, 1);
    });

    // Finish pointer drag cancelled
    act(() => {
      result.current.finishPointer({ x: 35, y: 45 }, 1, true);
    });

    expect(result.current.dragVisual?.settling).toBe(true);
    expect((result.current.dragVisual as any).releaseRect).toEqual({
      left: 30, // 35 - 5
      top: 40,  // 45 - 5
      width: 50,
      height: 50,
    });
  });

  it("captures releaseRect on committed drag", () => {
    const onCommit = vi.fn();
    const board = document.createElement("div");
    const cell = document.createElement("div");
    cell.setAttribute("data-armory-grid-metric", "cell");
    const stride = document.createElement("div");
    stride.setAttribute("data-armory-grid-metric", "stride");
    board.appendChild(cell);
    board.appendChild(stride);

    vi.spyOn(board, "getBoundingClientRect").mockReturnValue(mockDomRect({ left: 100, top: 100, width: 200, height: 200 }));
    vi.spyOn(cell, "getBoundingClientRect").mockReturnValue(mockDomRect({ left: 100, top: 100, width: 40, height: 40 }));
    vi.spyOn(stride, "getBoundingClientRect").mockReturnValue(mockDomRect({ left: 150, top: 100, width: 40, height: 40 }));

    const inventoryBoardRef = { current: board };

    const { result } = renderHook(() =>
      useBoardDrag({
        itemLookup: { id: "item-1" },
        getItemId: (item) => item.id,
        getOrigin: () => ({ kind: "inventory", placement: { col: 0, row: 0 } }),
        getFootprint: () => ({ w: 1, h: 1 }),
        inventoryBoardRef,
        occupiedRows: 0,
        onCommit,
      }),
    );

    act(() => {
      result.current.beginPointer({ id: "item-1" }, { left: 100, top: 100, width: 40, height: 40 }, { x: 120, y: 120 }, 1);
    });

    // Move to a position that falls within snap radius
    act(() => {
      result.current.movePointer({ x: 125, y: 125 }, 1);
    });

    // Destination should be mapped because we are near the cell
    expect(result.current.dragVisual?.destination).not.toBeNull();

    act(() => {
      result.current.finishPointer({ x: 125, y: 125 }, 1, false);
    });

    expect(onCommit).toHaveBeenCalled();
    expect(result.current.dragVisual?.settling).toBe(true);
    expect((result.current.dragVisual as any).releaseRect).toEqual({
      left: 105, // 125 - 20
      top: 105,  // 125 - 20
      width: 40,
      height: 40,
    });
  });
});
