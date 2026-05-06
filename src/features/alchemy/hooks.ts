import { useEffect, useRef, useState } from "react";

import type { CombatTextEvent } from "@/lib/battle";

import type { CardGhost, FloatingCombatText, ResolutionOption } from "./types";
import { COMBAT_TEXT_LANE_DELAY_MS, COMBAT_TEXT_LIFETIME_MS, SHIMMER_COOLDOWN_MS, SHIMMER_DURATION_MS, SHIMMER_INTRO_DELAY_MS } from "@/lib/game-constants";

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
// Entries are staggered by lane so simultaneous texts queue visually.

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

    nextEntries.forEach((entry) => {
      const delay = entry.lane * combatTextLaneDelayMs;
      setTimeout(() => {
        setFloatingCombatTexts((current) => [...current, entry]);
        scheduleExpiry(entry);
      }, delay);
    });
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
