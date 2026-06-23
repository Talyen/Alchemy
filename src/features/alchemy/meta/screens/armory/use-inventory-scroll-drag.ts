import { useRef, useState } from "react";

interface DragState {
  pointerId: number;
  startY: number;
  startScrollTop: number;
  moved: boolean;
}

const ITEM_SELECTOR = "[data-testid='armory-inventory-item'],[data-testid='armory-crafting-currency']";

export function useInventoryScrollDrag({
  canScroll,
  salvageMode,
  activeCurrencyId,
}: {
  canScroll: boolean;
  salvageMode: boolean;
  activeCurrencyId: string | null;
}) {
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [dragSequence, setDragSequence] = useState(0);

  // suppressingInteraction is true briefly after a scroll drag completes
  const suppressingInteraction = salvageMode ? false : dragSequence > 0;

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!canScroll || salvageMode || activeCurrencyId || event.pointerType === "touch" || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest(ITEM_SELECTOR)) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startScrollTop: event.currentTarget.scrollTop,
      moved: false,
    };
    setDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaY) > 4 && !drag.moved) {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      drag.moved = true;
      suppressClickRef.current = true;
      setDragSequence((current) => current + 1);
    }
    event.currentTarget.scrollTop = drag.startScrollTop - deltaY;
  }

  function finishDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setDragging(false);
    if (drag.moved) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
        setDragSequence(0);
      }, 150);
    }
  }

  return {
    suppressClickRef,
    dragging,
    suppressingInteraction,
    dragSequence,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp: finishDrag,
    handlePointerCancel: finishDrag,
  };
}
