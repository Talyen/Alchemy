// Floating combat text lifecycle for battle feedback.
// Depends on battle combat text events, alchemy UI types, and timing constants.
// Used by useBattleController so combat text timing stays outside pure battle logic.
import { useEffect, useRef, useState } from "react";

import type { CombatTextEvent } from "@/lib/battle";
import { COMBAT_TEXT_LANE_DELAY_MS, COMBAT_TEXT_LIFETIME_MS } from "@/lib/game-constants";

import type { FloatingCombatText } from "../types";

const combatTextLifetimeMs = COMBAT_TEXT_LIFETIME_MS;
const combatTextLaneDelayMs = COMBAT_TEXT_LANE_DELAY_MS;

// Manages temporary floating numbers so pure combat can emit events without knowing about React timers.
export function useFloatingCombatTexts() {
  const [floatingCombatTexts, setFloatingCombatTexts] = useState<FloatingCombatText[]>([]);
  const timerRefs = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timerRefs.current.forEach((timer) => window.clearTimeout(timer));
      timerRefs.current = [];
    };
  }, []);

  function getCombatTextDisplayText(event: CombatTextEvent) {
    if (event.kind === "notice") return event.text;
    if (event.kind === "damage") return `-${event.amount}`;
    const showPlus = event.kind === "heal" || event.kind === "status";
    return `${showPlus ? "+" : ""}${event.amount}`;
  }

  function scheduleExpiry(entry: FloatingCombatText) {
    const timer = window.setTimeout(
      () => setFloatingCombatTexts((current) => current.filter((c) => c.id !== entry.id)),
      combatTextLifetimeMs + entry.lane * combatTextLaneDelayMs,
    );
    timerRefs.current.push(timer);
  }

  function showCombatTexts(events: CombatTextEvent[]) {
    if (events.length === 0) return;
    const laneCounts: Record<"player" | "enemy", number> = { player: 0, enemy: 0 };
    const createdAt = performance.now();
    const nextEntries = events.map((event, index) => {
      const lane = laneCounts[event.target];
      laneCounts[event.target] += 1;
      return {
        ...event,
        lane,
        id: `${createdAt}-${event.target}-${event.stat}-${index}`,
        displayText: getCombatTextDisplayText(event),
      } satisfies FloatingCombatText;
    });

    nextEntries.forEach((entry) => {
      const delay = entry.lane * combatTextLaneDelayMs;
      const timer = window.setTimeout(() => {
        setFloatingCombatTexts((current) => [...current, entry]);
        scheduleExpiry(entry);
      }, delay);
      timerRefs.current.push(timer);
    });
  }

  return { floatingCombatTexts, showCombatTexts };
}
