import { useUiStore, isBattleInspectionOpen } from "../../shared/stores/ui-store";
import { useCallback, useEffect, useRef, type RefObject } from "react";

import { type BattleSnapshot } from "@/lib/battle";
import { AUTO_END_TURN_DELAY_MS } from "@/lib/game-constants";
import { resolveGameDelay } from "@/lib/animation/game-timer";

import { useLatestRef } from "../../shared/ui/use-latest-ref";
import type { Screen } from "@/lib/routing";
import { usePlaybackBlocked } from "./playback-gate";
import { findBestPlayableHandCard, handHasPlayableCard } from "./playable-hand";
import type { BattlePlaybackPresentationGate } from "./presentation/use-hand-presentation";

interface AutoEndTurnOptions {
  autoEndTurn: boolean;
  isAutoplayEnabled?: boolean;
  screen: Screen;
  battleState: BattleSnapshot;
  hasActiveBattle: boolean;
  gameMenuOpen?: boolean;
  isCardPlayInProgress?: () => boolean;
  isProgressSavePending?: (() => boolean) | undefined;
  onEndTurn: () => void;
  presentationGateRef: RefObject<BattlePlaybackPresentationGate>;
  scheduleAutoEndTurnRef: RefObject<(state?: BattleSnapshot) => void>;
}

export function useBattleAutoEndTurn({
  autoEndTurn,
  isAutoplayEnabled = false,
  screen,
  battleState,
  hasActiveBattle,
  gameMenuOpen = false,
  isCardPlayInProgress,
  isProgressSavePending,
  onEndTurn,
  presentationGateRef,
  scheduleAutoEndTurnRef,
}: AutoEndTurnOptions) {
  const inspectionOpen = useUiStore(isBattleInspectionOpen);
  const onEndTurnRef = useLatestRef(onEndTurn);
  const battleStateRef = useLatestRef(battleState);
  const autoEndTurnRef = useLatestRef(autoEndTurn);
  const autoplayEnabledRef = useLatestRef(isAutoplayEnabled);
  const autoEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlaybackBlocked = usePlaybackBlocked({
    screen,
    battleState,
    hasActiveBattle,
    gameMenuOpen,
    isCardPlayInProgress,
    isProgressSavePending,
    presentationGateRef,
  });

  const clearAutoEndTurn = useCallback(() => {
    if (autoEndTimerRef.current) clearTimeout(autoEndTimerRef.current);
    autoEndTimerRef.current = null;
  }, []);

  const canAutoEndTurn = useCallback(
    (current: BattleSnapshot) => {
      if (!autoEndTurnRef.current || isPlaybackBlocked(current)) return false;
      return autoplayEnabledRef.current ? findBestPlayableHandCard(current) === null : !handHasPlayableCard(current);
    },
    [autoEndTurnRef, autoplayEnabledRef, isPlaybackBlocked],
  );

  // React-lifecycle timer by design, not a battle-session timer: it is cleared
  // on unmount, on every reschedule, and explicitly on end-turn commit via
  // clearAutoEndTurn, and the fire-time gate above re-checks live battle state,
  // so a stale fire after a battle transition is a no-op.

  const scheduleAutoEndTurnRaw = useCallback(
    (state?: BattleSnapshot) => {
      clearAutoEndTurn();
      if (!canAutoEndTurn(state ?? battleStateRef.current)) return;
      autoEndTimerRef.current = setTimeout(() => {
        autoEndTimerRef.current = null;
        if (canAutoEndTurn(battleStateRef.current)) onEndTurnRef.current();
      }, resolveGameDelay(AUTO_END_TURN_DELAY_MS));
    },
    [battleStateRef, canAutoEndTurn, clearAutoEndTurn, onEndTurnRef],
  );

  useEffect(() => {
    scheduleAutoEndTurnRef.current = scheduleAutoEndTurnRaw;
  });

  const scheduleAutoEndTurn = useCallback(
    (state?: BattleSnapshot) => scheduleAutoEndTurnRef.current(state),
    [scheduleAutoEndTurnRef],
  );

  useEffect(() => {
    // A playback/save wake can precede React's updated battle snapshot.
    // Recheck the committed render too so that wake cannot strand an exhausted hand.
    scheduleAutoEndTurnRaw();
    return clearAutoEndTurn;
  }, [
    scheduleAutoEndTurnRaw,
    clearAutoEndTurn,
    autoEndTurn,
    isAutoplayEnabled,
    gameMenuOpen,
    inspectionOpen,
    battleState,
    screen,
    hasActiveBattle,
  ]);

  return { scheduleAutoEndTurn, clearAutoEndTurn };
}
