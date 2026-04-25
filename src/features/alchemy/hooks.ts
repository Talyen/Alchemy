import type { PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";

import type { CombatTextEvent } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";

import type { CardGhost, CardRect, DragPreview, FloatingCombatText, ResolutionOption } from "./types";
import { getCardRect } from "./utils";

const shimmerDurationMs = 1250;
const shimmerCooldownMs = 2600;
const shimmerIntroDelayMs = 500;
const combatTextLifetimeMs = 1280;
const combatTextLaneDelayMs = 80;
const dragStartThresholdPx = 10;

type DragSession = {
  card: BattleCard;
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

export function useCardGhosts() {
  const [cardGhosts, setCardGhosts] = useState<CardGhost[]>([]);

  function removeCardGhost(id: string) {
    setCardGhosts((current) => current.filter((ghost) => ghost.id !== id));
  }

  function spawnCardGhost(ghost: Omit<CardGhost, "id">) {
    const id = `${performance.now()}-${Math.random()}`;
    setCardGhosts((current) => [...current, { ...ghost, id }]);
  }

  return {
    cardGhosts,
    removeCardGhost,
    spawnCardGhost,
  };
}

export function useFloatingCombatTexts() {
  const [floatingCombatTexts, setFloatingCombatTexts] = useState<FloatingCombatText[]>([]);

  function getSignedAmountText(event: CombatTextEvent) {
    if (event.kind === "damage") {
      return String(event.amount);
    }

    const showPlus = event.kind === "heal" || event.kind === "status";
    return `${showPlus ? "+" : ""}${event.amount}`;
  }

  function showCombatTexts(events: CombatTextEvent[]) {
    if (events.length === 0) {
      return;
    }

    const laneCounts: Record<"player" | "enemy", number> = { player: 0, enemy: 0 };
    const createdAt = performance.now();
    const nextEntries = events.map((event, index) => {
      const lane = laneCounts[event.target];
      laneCounts[event.target] += 1;

      return {
        ...event,
        lane,
        id: `${createdAt}-${event.target}-${event.stat}-${index}`,
        signedAmountText: getSignedAmountText(event),
      } satisfies FloatingCombatText;
    });

    setFloatingCombatTexts((current) => [...current, ...nextEntries]);

    nextEntries.forEach((entry) => {
      window.setTimeout(() => {
        setFloatingCombatTexts((current) => current.filter((candidate) => candidate.id !== entry.id));
      }, combatTextLifetimeMs + entry.lane * combatTextLaneDelayMs);
    });
  }

  return {
    floatingCombatTexts,
    showCombatTexts,
  };
}

export function useShimmerController() {
  const [shimmerState, setShimmerState] = useState<{ cardId: string; token: number } | null>(null);
  const shimmerCooldownRef = useRef<Record<string, number>>({});
  const shimmerPendingRef = useRef<Record<string, number>>({});

  function maybeTriggerShimmer(cardId: string) {
    const now = Date.now();
    const previousTrigger = shimmerCooldownRef.current[cardId] ?? 0;
    if (now - previousTrigger < shimmerCooldownMs) {
      return;
    }

    if (shimmerPendingRef.current[cardId]) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const triggeredAt = Date.now();
      shimmerCooldownRef.current[cardId] = triggeredAt;
      setShimmerState({ cardId, token: triggeredAt });
      delete shimmerPendingRef.current[cardId];
    }, shimmerIntroDelayMs);

    shimmerPendingRef.current[cardId] = timeout;
  }

  useEffect(() => {
    if (!shimmerState) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setShimmerState((current) => (current?.token === shimmerState.token ? null : current));
    }, shimmerDurationMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [shimmerState]);

  useEffect(() => {
    return () => {
      Object.values(shimmerPendingRef.current).forEach((timeout) => {
        window.clearTimeout(timeout);
      });
      shimmerPendingRef.current = {};
    };
  }, []);

  return {
    shimmerState,
    maybeTriggerShimmer,
  };
}

export function useHandCardDrag(onRelease: (payload: { card: BattleCard; rect: CardRect; dragged: boolean; pointerX: number; pointerY: number }) => void) {
  const [dragSession, setDragSession] = useState<DragSession | null>(null);
  const onReleaseRef = useRef(onRelease);
  const ignoreClickCardIdRef = useRef<string | null>(null);

  onReleaseRef.current = onRelease;

  useEffect(() => {
    if (!dragSession) {
      return;
    }

    const activeSession = dragSession;

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerId !== activeSession.pointerId) {
        return;
      }

      setDragSession((current) => {
        if (!current || current.pointerId !== event.pointerId) {
          return current;
        }

        const movedFarEnough = Math.hypot(event.clientX - current.startX, event.clientY - current.startY) >= dragStartThresholdPx;

        return {
          ...current,
          currentX: event.clientX,
          currentY: event.clientY,
          dragging: current.dragging || movedFarEnough,
        };
      });
    }

    function handlePointerEnd(event: PointerEvent) {
      if (event.pointerId !== activeSession.pointerId) {
        return;
      }

      const finalRect = buildDragRect({
        x: activeSession.dragging ? event.clientX : activeSession.startX,
        y: activeSession.dragging ? event.clientY : activeSession.startY,
        offsetX: activeSession.pointerOffsetX,
        offsetY: activeSession.pointerOffsetY,
        originRect: activeSession.originRect,
      });

      if (activeSession.dragging) {
        ignoreClickCardIdRef.current = activeSession.card.id;
        window.setTimeout(() => {
          if (ignoreClickCardIdRef.current === activeSession.card.id) {
            ignoreClickCardIdRef.current = null;
          }
        }, 0);
      }

      onReleaseRef.current({
        card: activeSession.card,
        rect: finalRect,
        dragged: activeSession.dragging,
        pointerX: event.clientX,
        pointerY: event.clientY,
      });

      setDragSession(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [dragSession]);

  function beginCardDrag(card: BattleCard, event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    const rect = getCardRect(event.currentTarget.getBoundingClientRect());

    setDragSession({
      card,
      pointerId: event.pointerId,
      pointerOffsetX: event.clientX - rect.x,
      pointerOffsetY: event.clientY - rect.y,
      originRect: rect,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      dragging: false,
    });
  }

  function shouldIgnoreClick(cardId: string) {
    if (ignoreClickCardIdRef.current !== cardId) {
      return false;
    }

    ignoreClickCardIdRef.current = null;
    return true;
  }

  return {
    activeDraggedCardId: dragSession?.dragging ? dragSession.card.id : null,
    dragPreview: dragSession?.dragging
      ? {
          card: dragSession.card,
          rect: buildDragRect({
            x: dragSession.currentX,
            y: dragSession.currentY,
            offsetX: dragSession.pointerOffsetX,
            offsetY: dragSession.pointerOffsetY,
            originRect: dragSession.originRect,
          }),
          rotation: Math.max(-12, Math.min(12, (dragSession.currentX - dragSession.startX) / 18)),
        }
      : null satisfies DragPreview | null,
    beginCardDrag,
    shouldIgnoreClick,
  };
}

function buildDragRect({ x, y, offsetX, offsetY, originRect }: { x: number; y: number; offsetX: number; offsetY: number; originRect: CardRect }) {
  return {
    x: x - offsetX,
    y: y - offsetY,
    width: originRect.width,
    height: originRect.height,
  } satisfies CardRect;
}

export function useVirtualResolution(selectedResolution: ResolutionOption) {
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === "undefined" ? 1920 : window.innerWidth,
    height: typeof window === "undefined" ? 1080 : window.innerHeight,
  }));

  useEffect(() => {
    function updateViewport() {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    window.addEventListener("resize", updateViewport);
    return () => {
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  const [targetWidth, targetHeight] = selectedResolution.split("x").map(Number) as [number, number];
  const scale = Math.min(viewport.width / targetWidth, viewport.height / targetHeight);
  const clampedScale = Number.isFinite(scale) ? Math.max(0.45, Math.min(scale, 1.35)) : 1;

  return {
    frameStyle: {
      width: `${targetWidth * clampedScale}px`,
      height: `${targetHeight * clampedScale}px`,
    },
    stageStyle: {
      width: `${targetWidth}px`,
      height: `${targetHeight}px`,
      transform: `scale(${clampedScale})`,
      transformOrigin: "top left",
    },
  };
}
