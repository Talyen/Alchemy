// Auto-end-turn scheduler for battle when the player has no playable actions.
// Depends on battle cost prediction, React timers, and screen/turn state.
import { useCallback, useEffect, useRef } from "react";

import { getEffectiveCost, type BattleState } from "@/lib/battle";
import { AUTO_END_TURN_DELAY } from "@/lib/game-constants";

import type { Screen } from "../../shared/types";

interface AutoEndTurnOptions {
  autoEndTurn: boolean;
  screen: Screen;
  battleState: BattleState;
  onEndTurn: () => void;
}

// Schedules end turn only after the battle reaches a stable no-actions state.
export function useBattleAutoEndTurn({ autoEndTurn, screen, battleState, onEndTurn }: AutoEndTurnOptions) {
  const onEndTurnRef = useRef(onEndTurn);
  const autoEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onEndTurnRef.current = onEndTurn;
  }, [onEndTurn]);

  const clearAutoEndTurn = useCallback(() => {
    if (autoEndTimerRef.current) clearTimeout(autoEndTimerRef.current);
    autoEndTimerRef.current = null;
  }, []);

  const scheduleAutoEndTurnRaw = useCallback(
    (state: BattleState = battleState) => {
      clearAutoEndTurn();
      if (
        !autoEndTurn ||
        screen !== "battle" ||
        state.turnPhase !== "player" ||
        state.enemyHealth <= 0 ||
        (state.playerHealth <= 0 && !state.deathsDoorActive) ||
        state.wishOptions
      )
        return;
      const hasPlayableCard = state.hand.some((card) => state.mana >= getEffectiveCost(state, card));
      if (hasPlayableCard) return;
      autoEndTimerRef.current = setTimeout(() => onEndTurnRef.current(), AUTO_END_TURN_DELAY);
    },
    [autoEndTurn, battleState, clearAutoEndTurn, screen],
  );

  const scheduleAutoEndTurnRef = useRef(scheduleAutoEndTurnRaw);
  useEffect(() => {
    scheduleAutoEndTurnRef.current = scheduleAutoEndTurnRaw;
  }, [scheduleAutoEndTurnRaw]);

  const scheduleAutoEndTurn = useCallback((state: BattleState) => scheduleAutoEndTurnRef.current(state), []);

  useEffect(() => {
    scheduleAutoEndTurnRaw();
    return clearAutoEndTurn;
  }, [scheduleAutoEndTurnRaw, clearAutoEndTurn]);

  return { scheduleAutoEndTurn, clearAutoEndTurn };
}
