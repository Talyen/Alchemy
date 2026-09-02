import { useCallback, useEffect, useRef, type RefObject } from "react";

import { type BattleState } from "@/lib/battle";
import { AUTO_END_TURN_DELAY } from "@/lib/game-constants";
import { resolveGameDelay } from "@/lib/animation/game-timer";

import { useLatestRef } from "../../shared/hooks";
import type { Screen } from "@/lib/routing";
import { isBattlePlaybackBlocked } from "./autoplay-driver";
import { handHasPlayableCard } from "./playable-hand";
import type { BattlePlaybackPresentationGate } from "./use-battle-presentation-gate";

interface AutoEndTurnOptions {
  autoEndTurn: boolean;
  screen: Screen;
  battleState: BattleState;
  hasActiveBattle: boolean;
  isCardPlayInProgress?: () => boolean;
  onEndTurn: () => void;
  presentationGateRef: RefObject<BattlePlaybackPresentationGate>;
  scheduleAutoEndTurnRef: RefObject<(state?: BattleState) => void>;
}

export function useBattleAutoEndTurn({
  autoEndTurn,
  screen,
  battleState,
  hasActiveBattle,
  isCardPlayInProgress,
  onEndTurn,
  presentationGateRef,
  scheduleAutoEndTurnRef,
}: AutoEndTurnOptions) {
  const onEndTurnRef = useLatestRef(onEndTurn);
  const isCardPlayInProgressRef = useLatestRef(isCardPlayInProgress);
  const battleStateRef = useLatestRef(battleState);
  const screenRef = useLatestRef(screen);
  const hasActiveBattleRef = useLatestRef(hasActiveBattle);
  const autoEndTurnRef = useLatestRef(autoEndTurn);
  const autoEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoEndTurn = useCallback(() => {
    if (autoEndTimerRef.current) clearTimeout(autoEndTimerRef.current);
    autoEndTimerRef.current = null;
  }, []);

  const scheduleAutoEndTurnRaw = useCallback(
    (state?: BattleState) => {
      const current = state ?? battleStateRef.current;
      const presentation = presentationGateRef.current;
      clearAutoEndTurn();
      if (
        !autoEndTurnRef.current ||
        isBattlePlaybackBlocked({
          screen: screenRef.current,
          battleState: current,
          hasActiveBattle: hasActiveBattleRef.current,
          cardTransferInProgress: presentation.cardTransferInProgress,
          hiddenHandCardKeys: presentation.hiddenHandCardKeys,
          cardPlayInProgress: Boolean(isCardPlayInProgressRef.current?.()),
        })
      )
        return;
      if (handHasPlayableCard(current)) return;
      autoEndTimerRef.current = setTimeout(() => onEndTurnRef.current(), resolveGameDelay(AUTO_END_TURN_DELAY));
    },
    [
      autoEndTurnRef,
      battleStateRef,
      clearAutoEndTurn,
      hasActiveBattleRef,
      isCardPlayInProgressRef,
      onEndTurnRef,
      presentationGateRef,
      screenRef,
    ],
  );

  // eslint-disable-next-line react-hooks/refs -- latest scheduler; not a render input
  scheduleAutoEndTurnRef.current = scheduleAutoEndTurnRaw;

  const scheduleAutoEndTurn = useCallback(
    (state?: BattleState) => scheduleAutoEndTurnRef.current(state),
    [scheduleAutoEndTurnRef],
  );

  useEffect(() => {
    scheduleAutoEndTurnRaw();
    return clearAutoEndTurn;
  }, [scheduleAutoEndTurnRaw, clearAutoEndTurn, autoEndTurn]);

  return { scheduleAutoEndTurn, clearAutoEndTurn };
}
