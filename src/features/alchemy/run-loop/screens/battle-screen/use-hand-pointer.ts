import { type MouseEvent, type FocusEvent, type RefObject, useCallback, useLayoutEffect, useRef } from "react";
import { HAND_FAN_ROTATION_DEGREES } from "@/lib/game-constants";
import type { BattleCard } from "@/lib/game-data";
import { useUiStore } from "../../../shared/stores/ui-store";
import { getHoverId } from "../../../shared/utils";
import { getHandCardKey } from "../../battle/playable-hand";

function selectCard(key: string | null) {
  const ui = useUiStore.getState();
  const id = key === null ? null : getHoverId("hand", key);
  if (id === ui.hoveredCardId) return;
  if (id === null && !ui.hoveredCardId?.startsWith("hand-")) return;
  ui.setHoveredCardId(id);
  if (id !== null) ui.maybeTriggerShimmer(id);
}

interface HandGeometry {
  container: HTMLDivElement;
  left: number;
  right: number;
  top: number;
  bottom: number;
  slots: Array<{ element: HTMLElement; center: number }>;
}

function measureHand(container: HTMLDivElement): HandGeometry | null {
  const slots = container.querySelectorAll<HTMLElement>("[data-hand-slot]");
  const first = slots[0];
  const last = slots[slots.length - 1];
  if (!first || !last) return null;
  const bounds = container.getBoundingClientRect();
  const firstRect = first.getBoundingClientRect();
  const lastRect = last === first ? firstRect : last.getBoundingClientRect();
  const artwork = first.querySelector("button");
  const scale = first.offsetWidth > 0 ? firstRect.width / first.offsetWidth : 1;
  const width = artwork?.offsetWidth ?? first.offsetWidth;
  const height = artwork?.offsetHeight ?? first.offsetHeight;
  const fanAngle = (((slots.length - 1) / 2) * HAND_FAN_ROTATION_DEGREES * Math.PI) / 180;
  const halfCard = ((width * 1.035 + height * Math.sin(fanAngle)) * scale) / 2;
  return {
    container,
    left: firstRect.left + firstRect.width / 2 - halfCard,
    right: lastRect.left + lastRect.width / 2 + halfCard,
    top: bounds.top,
    bottom: bounds.bottom,
    slots: Array.from(slots, (slot) => {
      const rect = slot === first ? firstRect : slot === last ? lastRect : slot.getBoundingClientRect();
      return { element: slot, center: rect.left + rect.width / 2 };
    }),
  };
}

function resolveCard(geometry: HandGeometry | null, x: number, y: number) {
  if (!geometry || x < geometry.left || x > geometry.right || y < geometry.top || y > geometry.bottom) return null;
  let nearest: HTMLElement | undefined;
  let distance = Infinity;
  for (const { element, center } of geometry.slots) {
    const candidate = Math.abs(x - center);
    if (candidate < distance) {
      nearest = element;
      distance = candidate;
    }
  }
  return nearest?.dataset.handHidden ? null : (nearest?.dataset.handSlot ?? null);
}

export function useHandPointer(
  cards: readonly BattleCard[],
  hiddenKeys: readonly string[],
  buttons: RefObject<Record<string, HTMLButtonElement | null>>,
) {
  const ref = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const geometry = useRef<HandGeometry | null>(null);
  const frame = useRef<number | null>(null);

  const invalidateGeometry = useCallback(() => {
    geometry.current = null;
  }, []);

  const resolvePointer = useCallback(
    (container: HTMLDivElement, x: number, y: number, fresh = false) => {
      if (fresh || geometry.current?.container !== container) geometry.current = measureHand(container);
      // Share reads only within one frame. Ancestor transforms and reflow animations
      // can move the hand without a resize; never retain their geometry across frames.
      frame.current ??= requestAnimationFrame(() => {
        frame.current = null;
        invalidateGeometry();
      });
      return resolveCard(geometry.current, x, y);
    },
    [invalidateGeometry],
  );

  useLayoutEffect(invalidateGeometry);
  useLayoutEffect(() => {
    const container = ref.current;
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(invalidateGeometry);
    if (container) observer?.observe(container);
    window.addEventListener("resize", invalidateGeometry);
    window.addEventListener("scroll", invalidateGeometry, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", invalidateGeometry);
      window.removeEventListener("scroll", invalidateGeometry, true);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      invalidateGeometry();
    };
  }, [invalidateGeometry]);

  useLayoutEffect(() => {
    const container = ref.current;
    const point = pointer.current;
    if (container && point) {
      selectCard(resolvePointer(container, point.x, point.y));
    } else {
      const hovered = useUiStore.getState().hoveredCardId;
      if (
        !cards.some((card, index) => {
          const key = getHandCardKey(card, index);
          return !hiddenKeys.includes(key) && getHoverId("hand", key) === hovered;
        })
      )
        selectCard(null);
    }
  }, [cards, hiddenKeys, resolvePointer]);

  useLayoutEffect(() => () => selectCard(null), []);

  function onMouseMove(event: MouseEvent<HTMLDivElement>) {
    pointer.current = { x: event.clientX, y: event.clientY };
    selectCard(resolvePointer(event.currentTarget, event.clientX, event.clientY));
  }

  function onMouseLeave() {
    pointer.current = null;
    const active = document.activeElement;
    const slot =
      active instanceof HTMLElement && ref.current?.contains(active)
        ? active.closest<HTMLElement>("[data-hand-slot]")
        : null;
    selectCard(slot?.dataset.handHidden ? null : (slot?.dataset.handSlot ?? null));
  }

  function onClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (event.detail === 0) return;
    event.preventDefault();
    event.stopPropagation();
    const key = resolvePointer(event.currentTarget, event.clientX, event.clientY, true);
    selectCard(key);
    if (key !== null) buttons.current[key]?.click();
  }

  function onFocusCapture(event: FocusEvent<HTMLDivElement>) {
    pointer.current = null;
    const slot = event.target.closest<HTMLElement>("[data-hand-slot]");
    selectCard(slot?.dataset.handHidden ? null : (slot?.dataset.handSlot ?? null));
  }

  function onMouseDownCapture(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  return {
    ref,
    onMouseMove,
    onMouseLeave,
    onClickCapture,
    onFocusCapture,
    onBlurCapture: () => {
      const container = ref.current;
      const point = pointer.current;
      selectCard(container && point ? resolvePointer(container, point.x, point.y) : null);
    },
    onMouseDownCapture,
  };
}
