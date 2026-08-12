// Auto-end-turn scheduler for battle when the player has no playable actions.
// Depends on battle cost prediction, React timers, and screen/turn state.
import { useCallback, useEffect, useMemo, useRef } from "react";

import { canPlayCard, type BattleState } from "@/lib/battle";
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

/** The battle fields that decide whether any hand card is playable right now. */
type PlayabilityInput = Pick<
  BattleState,
  | "hand"
  | "mana"
  | "turnPhase"
  | "wishOptions"
  | "enemyHealth"
  | "playerHealth"
  | "deathsDoorActive"
  | "playerStatuses"
  | "flags"
  | "talentEffects"
  | "trinketEffects"
>;

function handHasPlayableCard(input: PlayabilityInput): boolean {
  // canPlayCard only reads the fields captured by PlayabilityInput.
  return input.hand.some((card, index) => canPlayCard(input as BattleState, card, index));
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

  // Memoized on the playability-relevant battle fields so battle commits that
  // leave the hand/mana/status unchanged (e.g. enemy-phase ticks) don't rescan.
  const hasPlayableCard = useMemo(
    () =>
      handHasPlayableCard({
        hand: battleState.hand,
        mana: battleState.mana,
        turnPhase: battleState.turnPhase,
        wishOptions: battleState.wishOptions,
        enemyHealth: battleState.enemyHealth,
        playerHealth: battleState.playerHealth,
        deathsDoorActive: battleState.deathsDoorActive,
        playerStatuses: battleState.playerStatuses,
        flags: battleState.flags,
        talentEffects: battleState.talentEffects,
        trinketEffects: battleState.trinketEffects,
      }),
    [
      battleState.hand,
      battleState.mana,
      battleState.turnPhase,
      battleState.wishOptions,
      battleState.enemyHealth,
      battleState.playerHealth,
      battleState.deathsDoorActive,
      battleState.playerStatuses,
      battleState.flags,
      battleState.talentEffects,
      battleState.trinketEffects,
    ],
  );

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
      const canPlay =
        state === battleState ? hasPlayableCard : state.hand.some((card, index) => canPlayCard(state, card, index));
      if (canPlay) return;
      autoEndTimerRef.current = setTimeout(() => onEndTurnRef.current(), AUTO_END_TURN_DELAY);
    },
    [
      autoEndTurn,
      battleState,
      cardTransferInProgress,
      clearAutoEndTurn,
      hasActiveBattle,
      hasPlayableCard,
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
