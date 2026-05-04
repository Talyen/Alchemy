import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";

import type { CombatTextEvent } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";

import type { CardGhost, CardRect, DragPreview, FloatingCombatText, ResolutionOption } from "./types";
import { COMBAT_TEXT_LANE_DELAY_MS, COMBAT_TEXT_LIFETIME_MS, DRAG_START_THRESHOLD_PX, DRAG_ROTATION_CLAMP, DRAG_ROTATION_DIVISOR, SHIMMER_COOLDOWN_MS, SHIMMER_DURATION_MS, SHIMMER_INTRO_DELAY_MS } from "@/lib/game-constants";

// ---- Card Shimmer (Hover Effect) ----
// Manages the "shimmer" animation that sweeps across card art on mouse hover.
// Cooldown prevents rapid re-triggering; intro delay ensures the first hover
// on a screen doesn't feel delayed.

const shimmerDurationMs = SHIMMER_DURATION_MS;
const shimmerCooldownMs = SHIMMER_COOLDOWN_MS;
const shimmerIntroDelayMs = SHIMMER_INTRO_DELAY_MS;

export function useShimmerController() {
  const [shimmerState, setShimmerState] = useState<{ cardId: string; token: number } | null>(null);
  const lastTriggerTimeRef = useRef(0);

  function maybeTriggerShimmer(cardId: string) {
    const now = performance.now();
    if (now - lastTriggerTimeRef.current < shimmerCooldownMs) return;
    lastTriggerTimeRef.current = now;
    setShimmerState({ cardId, token: performance.now() });
  }

  return { shimmerState, maybeTriggerShimmer };
}

// ---- Floating Combat Text ----
// Manages the lifecycle of floating damage/heal numbers. Events are grouped
// by (target, kind, stat) via mergeCombatText in effects.ts, so multi-hit
// cards produce a single float instead of overlapping numbers.

const combatTextLifetimeMs = COMBAT_TEXT_LIFETIME_MS;
const combatTextLaneDelayMs = COMBAT_TEXT_LANE_DELAY_MS;

export function useFloatingCombatTexts() {
  const [floatingCombatTexts, setFloatingCombatTexts] = useState<FloatingCombatText[]>([]);

  function getSignedAmountText(event: CombatTextEvent) {
    if (event.kind === "damage") return `-${event.amount}`;
    const showPlus = event.kind === "heal" || event.kind === "status";
    return `${showPlus ? "+" : ""}${event.amount}`;
  }

  function scheduleExpiry(entry: FloatingCombatText) {
    setTimeout(() => setFloatingCombatTexts((current) => current.filter((c) => c.id !== entry.id)), combatTextLifetimeMs + entry.lane * combatTextLaneDelayMs);
  }

  function showCombatTexts(events: CombatTextEvent[]) {
    if (events.length === 0) return;
    const laneCounts: Record<"player" | "enemy", number> = { player: 0, enemy: 0 };
    const createdAt = performance.now();
    const nextEntries = events.map((event, index) => {
      const lane = laneCounts[event.target];
      laneCounts[event.target] += 1;
      return { ...event, lane, id: `${createdAt}-${event.target}-${event.stat}-${index}`, signedAmountText: getSignedAmountText(event) } satisfies FloatingCombatText;
    });
    setFloatingCombatTexts((current) => [...current, ...nextEntries]);
    nextEntries.forEach(scheduleExpiry);
  }

  return { floatingCombatTexts, showCombatTexts };
}

// ---- Card Ghosts (Play Animations) ----
// Manages card "ghosts" — clone images that fly from hand to target zone during
// card play. Each ghost has a variant (draw-in, discard-out, activate, play-travel)
// that determines its animation CSS.

export function useCardGhosts() {
  const [cardGhosts, setCardGhosts] = useState<CardGhost[]>([]);

  function removeCardGhost(id: string) { setCardGhosts((current) => current.filter((ghost) => ghost.id !== id)); }
  function clearCardGhosts() { setCardGhosts([]); }
  function spawnCardGhost(ghost: Omit<CardGhost, "id">) {
    const id = `${performance.now()}-${Math.random()}`;
    setCardGhosts((current) => [...current, { ...ghost, id }]);
  }

  return { cardGhosts, removeCardGhost, clearCardGhosts, spawnCardGhost };
}

// ---- Hand Card Drag (Desktop Aiming) ----
// On desktop, clicking a card plays it immediately. Dragging a card into the
// battlefield area aims it (e.g., for positional effects). The drag threshold
// prevents accidental drags from normal clicking.

const dragStartThresholdPx = DRAG_START_THRESHOLD_PX;

type DragSession = {
  card: BattleCard;
  index: number;
  pointerId: number;
  pointerOffsetX: number;
  pointerOffsetY: number;
  originRect: CardRect;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  dragging: boolean;
};

export function useHandCardDrag(onRelease: (payload: { card: BattleCard; index: number; rect: CardRect; dragged: boolean; pointerX: number; pointerY: number }) => void) {
  const [dragSession, setDragSession] = useState<DragSession | null>(null);
  const onReleaseRef = useRef(onRelease);
  const ignoreClickCardIdRef = useRef<string | null>(null);
  onReleaseRef.current = onRelease;

  useEffect(() => {
    if (!dragSession) return;
    const session = dragSession;

    function onPointerMove(event: PointerEvent) {
      if (event.pointerId !== session.pointerId) return;
      setDragSession((current) => {
        if (!current || current.pointerId !== event.pointerId) return current;
        const dragged = current.dragging || Math.hypot(event.clientX - current.startX, event.clientY - current.startY) >= dragStartThresholdPx;
        return { ...current, currentX: event.clientX, currentY: event.clientY, dragging: dragged };
      });
    }

    function scheduleClickSuppression() {
      ignoreClickCardIdRef.current = session.card.id;
      setTimeout(() => { if (ignoreClickCardIdRef.current === session.card.id) ignoreClickCardIdRef.current = null; }, 0);
    }

    function onPointerEnd(event: PointerEvent) {
      if (event.pointerId !== session.pointerId) return;
      const finalRect = { x: (session.dragging ? event.clientX : session.startX) - session.pointerOffsetX, y: (session.dragging ? event.clientY : session.startY) - session.pointerOffsetY, width: session.originRect.width, height: session.originRect.height };
      if (session.dragging) scheduleClickSuppression();
      onReleaseRef.current({ card: session.card, index: session.index, rect: finalRect, dragged: session.dragging, pointerX: event.clientX, pointerY: event.clientY });
      setDragSession(null);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [dragSession]);

  function beginCardDrag(card: BattleCard, index: number, event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    setDragSession({ card, index, pointerId: event.pointerId, pointerOffsetX: event.clientX - rect.x, pointerOffsetY: event.clientY - rect.y, originRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, startX: event.clientX, startY: event.clientY, currentX: event.clientX, currentY: event.clientY, dragging: false });
  }

  function shouldIgnoreClick(cardId: string) {
    if (ignoreClickCardIdRef.current !== cardId) return false;
    ignoreClickCardIdRef.current = null;
    return true;
  }

  return {
    activeDraggedCardId: dragSession?.dragging ? dragSession.card.id : null,
    dragPreview: dragSession?.dragging ? {
      card: dragSession.card,
      rect: { x: dragSession.currentX - dragSession.pointerOffsetX, y: dragSession.currentY - dragSession.pointerOffsetY, width: dragSession.originRect.width, height: dragSession.originRect.height },
      rotation: Math.max(-DRAG_ROTATION_CLAMP, Math.min(DRAG_ROTATION_CLAMP, (dragSession.currentX - dragSession.startX) / DRAG_ROTATION_DIVISOR)),
    } : null satisfies DragPreview | null,
    beginCardDrag,
    shouldIgnoreClick,
  };
}

// ---- Virtual Resolution ----
// Wraps the game canvas in a CSS scale transform so it fits the window at any
// resolution. The stage uses the selected resolution's aspect ratio, scaled
// to fit within the viewport while respecting the 0.45-1.35 clamp to prevent
// extreme scaling on tiny or massive screens.
export function useVirtualResolution(selectedResolution: ResolutionOption) {
  const [viewportSize, setViewportSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));

  useEffect(() => {
    function handleResize() { setViewportSize({ width: window.innerWidth, height: window.innerHeight }); }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [stageWidth, stageHeight] = selectedResolution.split("x").map(Number);
  const viewportAspect = viewportSize.width / viewportSize.height;
  const stageAspect = stageWidth / stageHeight;

  let scale: number;
  if (viewportAspect > stageAspect) {
    scale = viewportSize.height / stageHeight;
  } else {
    scale = viewportSize.width / stageWidth;
  }
  scale = Math.max(0.45, Math.min(1.35, scale));

  const frameWidth = stageWidth * scale;
  const frameHeight = stageHeight * scale;

  return {
    frameStyle: { width: `${frameWidth}px`, height: `${frameHeight}px` },
    stageStyle: { width: `${stageWidth}px`, height: `${stageHeight}px`, transform: `scale(${scale})`, transformOrigin: "top left", left: 0, top: 0 },
  };
}
