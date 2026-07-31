// Auto-end-turn scheduler for battle when the player has no playable actions.
// Depends on battle cost prediction, React timers, and screen/turn state.
import { useCallback, useEffect, useRef } from "react";

import { computeEffectiveCost, type BattleState } from "@/lib/battle";
import { AUTO_END_TURN_DELAY } from "@/lib/game-constants";

import { useLatestRef } from "../../shared/hooks";
import type { Screen } from "../../shared/types";

interface AutoEndTurnOptions {
  autoEndTurn: boolean;
  screen: Screen;
  battleState: BattleState;
  hasActiveBattle: boolean;
  cardTransferInProgress: boolean;
  hiddenHandCardKeys: Set<string>;
  onEndTurn: () => void;
}

// Schedules end turn only after the battle reaches a stable no-actions state.
export function useBattleAutoEndTurn({
  autoEndTurn,
  screen,
  battleState,
  hasActiveBattle,
  cardTransferInProgress,
  hiddenHandCardKeys,
  onEndTurn,
}: AutoEndTurnOptions) {
  const onEndTurnRef = useLatestRef(onEndTurn);
  const autoEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoEndTurn = useCallback(() => {
    if (autoEndTimerRef.current) clearTimeout(autoEndTimerRef.current);
    autoEndTimerRef.current = null;
  }, []);

  const scheduleAutoEndTurnRaw = useCallback(
    (state: BattleState = battleState) => {
      clearAutoEndTurn();
      if (
        !autoEndTurn ||
        !hasActiveBattle ||
        cardTransferInProgress ||
        hiddenHandCardKeys.size > 0 ||
        screen !== "battle" ||
        state.turnPhase !== "player" ||
        state.enemyHealth <= 0 ||
        (state.playerHealth <= 0 && !state.deathsDoorActive) ||
        state.wishOptions
      )
        return;
      const hasPlayableCard = state.hand.some((card) => state.mana >= computeEffectiveCost(state, card).effectiveCost);
      if (hasPlayableCard) return;
      autoEndTimerRef.current = setTimeout(() => onEndTurnRef.current(), AUTO_END_TURN_DELAY);
    },
    [
      autoEndTurn,
      battleState,
      cardTransferInProgress,
      clearAutoEndTurn,
      hasActiveBattle,
      hiddenHandCardKeys,
      onEndTurnRef,
      screen,
    ],
  );

  const scheduleAutoEndTurnRef = useLatestRef(scheduleAutoEndTurnRaw);

  const scheduleAutoEndTurn = useCallback(
    (state: BattleState) => scheduleAutoEndTurnRef.current(state),
    [scheduleAutoEndTurnRef],
  );

  useEffect(() => {
    scheduleAutoEndTurnRaw();
    return clearAutoEndTurn;
  }, [scheduleAutoEndTurnRaw, clearAutoEndTurn]);

  return { scheduleAutoEndTurn, clearAutoEndTurn };
}
