// Auto-end-turn scheduler for battle when the player has no playable actions.
// Depends on battle cost prediction, React timers, and screen/turn state.
import { useEffect, useRef } from "react";

import { getEffectiveCost, type BattleState } from "@/lib/battle";
import { AUTO_END_TURN_DELAY } from "@/lib/game-constants";

import type { Screen } from "../types";

type AutoEndTurnOptions = {
  autoEndTurn: boolean;
  screen: Screen;
  battleState: BattleState;
  onEndTurn: () => void;
};

// Schedules end turn only after the battle reaches a stable no-actions state.
export function useBattleAutoEndTurn({ autoEndTurn, screen, battleState, onEndTurn }: AutoEndTurnOptions) {
  const onEndTurnRef = useRef(onEndTurn);
  const autoEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { onEndTurnRef.current = onEndTurn; }, [onEndTurn]);

  function clearAutoEndTurn() {
    if (autoEndTimerRef.current) clearTimeout(autoEndTimerRef.current);
    autoEndTimerRef.current = null;
  }

  function scheduleAutoEndTurn(state: BattleState = battleState) {
    clearAutoEndTurn();
    if (!autoEndTurn || screen !== "battle" || state.turnPhase !== "player" || state.enemyHealth <= 0 || state.playerHealth <= 0 || state.wishOptions) return;
    const hasPlayableCard = state.hand.some((card) => state.mana >= getEffectiveCost(state, card));
    if (hasPlayableCard) return;
    autoEndTimerRef.current = setTimeout(() => onEndTurnRef.current(), AUTO_END_TURN_DELAY);
  }

  useEffect(() => {
    scheduleAutoEndTurn();
    return clearAutoEndTurn;
  }, [autoEndTurn, battleState, screen]);

  return { scheduleAutoEndTurn, clearAutoEndTurn };
}
