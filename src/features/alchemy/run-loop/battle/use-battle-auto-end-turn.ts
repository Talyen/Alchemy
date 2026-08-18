// Auto-end-turn scheduler for battle when the player has no playable actions.
// Depends on battle cost prediction, React timers, and screen/turn state.
import { useCallback, useEffect, useRef } from "react";

import { type BattleState } from "@/lib/battle";
import { AUTO_END_TURN_DELAY } from "@/lib/game-constants";

import { useLatestRef } from "../../shared/hooks";
import type { Screen } from "@/lib/routing";
import { isBattlePlaybackBlocked } from "./autoplay-driver";
import { handHasPlayableCard } from "./playable-hand";

interface AutoEndTurnOptions {
  autoEndTurn: boolean;
  screen: Screen;
  battleState: BattleState;
  hasActiveBattle: boolean;
  cardTransferInProgress: boolean;
  hiddenHandCardKeys: Set<string>;
  isCardPlayInProgress?: () => boolean;
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
  isCardPlayInProgress,
  onEndTurn,
}: AutoEndTurnOptions) {
  const onEndTurnRef = useLatestRef(onEndTurn);
  const isCardPlayInProgressRef = useLatestRef(isCardPlayInProgress);
  const battleStateRef = useLatestRef(battleState);
  const autoEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoEndTurn = useCallback(() => {
    if (autoEndTimerRef.current) clearTimeout(autoEndTimerRef.current);
    autoEndTimerRef.current = null;
  }, []);

  const hasPlayableCard = handHasPlayableCard(battleState);

  const scheduleAutoEndTurnRaw = useCallback(
    (state?: BattleState) => {
      const current = state ?? battleStateRef.current;
      clearAutoEndTurn();
      if (
        !autoEndTurn ||
        isBattlePlaybackBlocked({
          screen,
          battleState: current,
          hasActiveBattle,
          cardTransferInProgress,
          hiddenHandCardKeys,
          cardPlayInProgress: Boolean(isCardPlayInProgressRef.current?.()),
        })
      )
        return;
      const canPlay = state === undefined ? hasPlayableCard : handHasPlayableCard(current);
      if (canPlay) return;
      autoEndTimerRef.current = setTimeout(() => onEndTurnRef.current(), AUTO_END_TURN_DELAY);
    },
    [
      autoEndTurn,
      battleStateRef,
      cardTransferInProgress,
      clearAutoEndTurn,
      hasActiveBattle,
      hasPlayableCard,
      hiddenHandCardKeys,
      isCardPlayInProgressRef,
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
