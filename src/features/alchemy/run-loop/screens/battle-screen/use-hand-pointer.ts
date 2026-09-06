import { type MouseEvent, type FocusEvent, type RefObject, useLayoutEffect, useRef } from "react";
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

function resolveCard(container: HTMLDivElement, x: number, y: number) {
  const slots = Array.from(container.querySelectorAll<HTMLElement>("[data-hand-slot]"));
  const first = slots[0];
  const last = slots.at(-1);
  if (!first || !last) return null;
  const bounds = container.getBoundingClientRect();
  const firstRect = first.getBoundingClientRect();
  const lastRect = last.getBoundingClientRect();
  const artwork = first.querySelector("button");
  const scale = first.offsetWidth > 0 ? firstRect.width / first.offsetWidth : 1;
  const width = artwork?.offsetWidth ?? first.offsetWidth;
  const height = artwork?.offsetHeight ?? first.offsetHeight;
  const fanAngle = (((slots.length - 1) / 2) * HAND_FAN_ROTATION_DEGREES * Math.PI) / 180;
  const halfCard = ((width * 1.035 + height * Math.sin(fanAngle)) * scale) / 2;
  if (
    x < firstRect.left + firstRect.width / 2 - halfCard ||
    x > lastRect.left + lastRect.width / 2 + halfCard ||
    y < bounds.top ||
    y > bounds.bottom
  )
    return null;
  let nearest = first;
  let distance = Infinity;
  for (const slot of slots) {
    const rect = slot.getBoundingClientRect();
    const candidate = Math.abs(x - rect.left - rect.width / 2);
    if (candidate < distance) {
      nearest = slot;
      distance = candidate;
    }
  }
  return nearest.dataset.handHidden ? null : (nearest.dataset.handSlot ?? null);
}

export function useHandPointer(
  cards: readonly BattleCard[],
  hiddenKeys: readonly string[],
  buttons: RefObject<Record<string, HTMLButtonElement | null>>,
) {
  const ref = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const container = ref.current;
    const point = pointer.current;
    if (container && point) {
      selectCard(resolveCard(container, point.x, point.y));
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
  }, [cards, hiddenKeys]);

  useLayoutEffect(() => () => selectCard(null), []);

  function onMouseMove(event: MouseEvent<HTMLDivElement>) {
    pointer.current = { x: event.clientX, y: event.clientY };
    selectCard(resolveCard(event.currentTarget, event.clientX, event.clientY));
  }

  function onMouseLeave() {
    pointer.current = null;
    selectCard(null);
  }

  function onClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (event.detail === 0) return;
    event.preventDefault();
    event.stopPropagation();
    const key = resolveCard(event.currentTarget, event.clientX, event.clientY);
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
    onBlurCapture: onMouseLeave,
    onMouseDownCapture,
  };
}
