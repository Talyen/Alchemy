import { useEffect, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";

interface PotionDrag {
  index: number;
  pointerId: number;
  startX: number;
  startY: number;
  scale: number;
  active: boolean;
  card: HTMLElement;
  capture: HTMLElement;
  panel: HTMLElement;
}

/** Move the mounted card itself; retain its layout space and normal click selection. */
export function usePotionDrag({
  disabled,
  identity,
  onDrop,
}: {
  disabled: boolean;
  identity: unknown;
  onDrop: (index: number, slot: number) => void;
}) {
  const drag = useRef<PotionDrag | null>(null);
  const suppressClick = useRef(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [inputs, setInputs] = useState({ disabled, identity });
  if (inputs.disabled !== disabled || inputs.identity !== identity) {
    setInputs({ disabled, identity });
    setDraggedIndex(null);
    setDropTarget(null);
  }
  function restoreCard() {
    const current = drag.current;
    drag.current = null;
    if (current) {
      current.card.style.transform = "";
      current.card.style.zIndex = "";
      current.card.style.pointerEvents = "";
      if (current.capture.hasPointerCapture?.(current.pointerId))
        current.capture.releasePointerCapture(current.pointerId);
    }
    return current;
  }
  function reset() {
    const current = restoreCard();
    setDraggedIndex(null);
    setDropTarget(null);
    return current;
  }
  useEffect(() => {
    restoreCard();
    const cancel = () => {
      if (drag.current?.active) suppressClick.current = true;
      reset();
    };
    window.addEventListener("blur", cancel);
    window.addEventListener("resize", cancel);
    window.addEventListener("scroll", cancel, true);
    return () => {
      window.removeEventListener("blur", cancel);
      window.removeEventListener("resize", cancel);
      window.removeEventListener("scroll", cancel, true);
      restoreCard();
    };
  }, [disabled, identity]);
  function target(current: PotionDrag, x: number, y: number) {
    for (const element of current.panel.querySelectorAll<HTMLElement>("[data-preparation-slot]")) {
      const rect = element.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom)
        return Number(element.dataset.preparationSlot);
    }
    return null;
  }
  function onPointerDown(index: number, event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || event.button !== 0 || !event.isPrimary) return;
    reset();
    suppressClick.current = false;
    const card = event.currentTarget.querySelector<HTMLElement>("[data-potion-movable]");
    const capture = event.target instanceof Element ? event.target.closest<HTMLElement>("button") : null;
    const panel = event.currentTarget.closest<HTMLElement>("[data-potion-preparation]");
    if (!card || !capture || !panel) return;
    const rect = card.getBoundingClientRect();
    drag.current = {
      index,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scale: card.offsetWidth > 0 ? rect.width / card.offsetWidth : 1,
      active: false,
      card,
      capture,
      panel,
    };
    capture.setPointerCapture?.(event.pointerId);
  }
  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || event.pointerId !== current.pointerId) return;
    const dx = event.clientX - current.startX,
      dy = event.clientY - current.startY;
    if (!current.active && Math.hypot(dx, dy) < 6) return;
    event.preventDefault();
    if (!current.active) {
      current.active = true;
      setDraggedIndex(current.index);
      current.card.style.zIndex = "140";
      current.card.style.pointerEvents = "none";
    }
    current.card.style.transform = `translate(${dx / current.scale}px, ${dy / current.scale}px)`;
    setDropTarget(target(current, event.clientX, event.clientY));
  }
  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || event.pointerId !== current.pointerId) return;
    const slot = current.active ? target(current, event.clientX, event.clientY) : null;
    if (current.active) {
      event.preventDefault();
      suppressClick.current = true;
    }
    reset();
    if (slot !== null && !disabled) onDrop(current.index, slot);
  }
  function cancel() {
    const current = drag.current;
    if (current?.active) suppressClick.current = true;
    reset();
    return current?.active ?? false;
  }
  function onClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    if (event.detail === 0) return;
    event.preventDefault();
    event.stopPropagation();
  }
  return {
    draggedIndex,
    dropTarget,
    cancel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: cancel,
    onLostPointerCapture: cancel,
    onClickCapture,
  };
}
