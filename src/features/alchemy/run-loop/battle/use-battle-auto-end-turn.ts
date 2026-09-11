import { useUiStore, isBattleInspectionOpen } from "../../shared/stores/ui-store";
import { useCallback, useEffect, useRef, type RefObject } from "react";

import { type BattleSnapshot } from "@/lib/battle";
import { AUTO_END_TURN_DELAY } from "@/lib/game-constants";
import { resolveGameDelay } from "@/lib/animation/game-timer";

import { useLatestRef } from "../../shared/hooks";
import type { Screen } from "@/lib/routing";
import { isBattlePlaybackBlocked } from "./autoplay-driver";
import { handHasPlayableCard } from "./playable-hand";
import type { BattlePlaybackPresentationGate } from "./presentation/use-hand-presentation";

interface AutoEndTurnOptions {
  autoEndTurn: boolean;
  screen: Screen;
  battleState: BattleSnapshot;
  hasActiveBattle: boolean;
  gameMenuOpen?: boolean;
  isCardPlayInProgress?: () => boolean;
  onEndTurn: () => void;
  presentationGateRef: RefObject<BattlePlaybackPresentationGate>;
  scheduleAutoEndTurnRef: RefObject<(state?: BattleSnapshot) => void>;
}

export function useBattleAutoEndTurn({
  autoEndTurn,
  screen,
  battleState,
  hasActiveBattle,
  gameMenuOpen = false,
  isCardPlayInProgress,
  onEndTurn,
  presentationGateRef,
  scheduleAutoEndTurnRef,
}: AutoEndTurnOptions) {
  const inspectionOpen = useUiStore(isBattleInspectionOpen);
  const onEndTurnRef = useLatestRef(onEndTurn);
  const isCardPlayInProgressRef = useLatestRef(isCardPlayInProgress);
  const battleStateRef = useLatestRef(battleState);
  const screenRef = useLatestRef(screen);
  const hasActiveBattleRef = useLatestRef(hasActiveBattle);
  const autoEndTurnRef = useLatestRef(autoEndTurn);
  const gameMenuOpenRef = useLatestRef(gameMenuOpen);
  const autoEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoEndTurn = useCallback(() => {
    if (autoEndTimerRef.current) clearTimeout(autoEndTimerRef.current);
    autoEndTimerRef.current = null;
  }, []);

  const canAutoEndTurn = useCallback(
    (current: BattleSnapshot) => {
      const presentation = presentationGateRef.current;
      return (
        autoEndTurnRef.current &&
        !isBattlePlaybackBlocked({
          screen: screenRef.current,
          battleState: current,
          hasActiveBattle: hasActiveBattleRef.current,
          cardTransferInProgress: presentation.cardTransferInProgress,
          hiddenHandCardKeys: presentation.hiddenHandCardKeys,
          cardPlayInProgress: Boolean(isCardPlayInProgressRef.current?.()),
          gameMenuOpen: gameMenuOpenRef.current,
          inspectionOpen: isBattleInspectionOpen(useUiStore.getState()),
        }) &&
        !handHasPlayableCard(current)
      );
    },
    [autoEndTurnRef, screenRef, hasActiveBattleRef, presentationGateRef, isCardPlayInProgressRef, gameMenuOpenRef],
  );

  const scheduleAutoEndTurnRaw = useCallback(
    (state?: BattleSnapshot) => {
      clearAutoEndTurn();
      if (!canAutoEndTurn(state ?? battleStateRef.current)) return;
      autoEndTimerRef.current = setTimeout(() => {
        autoEndTimerRef.current = null;
        if (canAutoEndTurn(battleStateRef.current)) onEndTurnRef.current();
      }, resolveGameDelay(AUTO_END_TURN_DELAY));
    },
    [battleStateRef, canAutoEndTurn, clearAutoEndTurn, onEndTurnRef],
  );

  // eslint-disable-next-line react-hooks/refs -- latest scheduler; not a render input
  scheduleAutoEndTurnRef.current = scheduleAutoEndTurnRaw;

  const scheduleAutoEndTurn = useCallback(
    (state?: BattleSnapshot) => scheduleAutoEndTurnRef.current(state),
    [scheduleAutoEndTurnRef],
  );

  useEffect(() => {
    scheduleAutoEndTurnRaw();
    return clearAutoEndTurn;
  }, [scheduleAutoEndTurnRaw, clearAutoEndTurn, autoEndTurn, gameMenuOpen, inspectionOpen]);

  return { scheduleAutoEndTurn, clearAutoEndTurn };
}
