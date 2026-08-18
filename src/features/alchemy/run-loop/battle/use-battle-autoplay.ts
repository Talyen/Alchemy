// Presentation-boundary autoplay: plays hand cards through the same path as a click.
import { useEffect, type RefObject } from "react";

import { AUTOPLAY_POST_PLAY_DELAY_MS, AUTOPLAY_RETRY_DELAY_MS } from "@/lib/game-constants";
import type { BattleState } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import type { Screen } from "@/lib/routing";

import { useLatestRef } from "../../shared/hooks";
import { driveAutoplay, findFirstPlayableHandCard, isBattlePlaybackBlocked } from "./autoplay-driver";
import type { HiddenHandCardKeys } from "./playable-hand";
import type { BattlePlaybackPresentationGate } from "./use-battle-presentation-gate";

interface UseBattleAutoplayOptions {
  enabled: boolean;
  screen: Screen;
  battleState: BattleState;
  hasActiveBattle: boolean;
  isCardPlayInProgress: () => boolean;
  gameMenuOpen: boolean;
  playCard: (card: BattleCard, index: number) => boolean;
  presentationGateRef: RefObject<BattlePlaybackPresentationGate>;
  wakeRef?: RefObject<(() => void) | null>;
}

export function isAutoplayBlocked(options: {
  screen: Screen;
  battleState: BattleState;
  hasActiveBattle: boolean;
  cardTransferInProgress: boolean;
  hiddenHandCardKeys: HiddenHandCardKeys;
  cardPlayInProgress: boolean;
  gameMenuOpen: boolean;
}): boolean {
  if (options.gameMenuOpen) return true;
  return isBattlePlaybackBlocked(options);
}

export function useBattleAutoplay({
  enabled,
  screen,
  battleState,
  hasActiveBattle,
  isCardPlayInProgress,
  gameMenuOpen,
  playCard,
  presentationGateRef,
  wakeRef,
}: UseBattleAutoplayOptions) {
  const battleStateRef = useLatestRef(battleState);
  const screenRef = useLatestRef(screen);
  const hasActiveBattleRef = useLatestRef(hasActiveBattle);
  const gameMenuOpenRef = useLatestRef(gameMenuOpen);
  const playCardRef = useLatestRef(playCard);
  const enabledRef = useLatestRef(enabled);
  const isCardPlayInProgressRef = useLatestRef(isCardPlayInProgress);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void driveAutoplay({
      signal: controller.signal,
      delayMs: AUTOPLAY_RETRY_DELAY_MS,
      postPlayDelayMs: AUTOPLAY_POST_PLAY_DELAY_MS,
      wakeRef,
      isEnabled: () => enabledRef.current && !controller.signal.aborted,
      isBlocked: () =>
        isAutoplayBlocked({
          screen: screenRef.current,
          battleState: battleStateRef.current,
          hasActiveBattle: hasActiveBattleRef.current,
          cardTransferInProgress: presentationGateRef.current.cardTransferInProgress,
          hiddenHandCardKeys: presentationGateRef.current.hiddenHandCardKeys,
          cardPlayInProgress: isCardPlayInProgressRef.current(),
          gameMenuOpen: gameMenuOpenRef.current,
        }),
      findPlayableCard: () => findFirstPlayableHandCard(battleStateRef.current),
      playCard: (card, index) => playCardRef.current(card, index),
    });
    return () => controller.abort();
  }, [
    enabled,
    battleStateRef,
    enabledRef,
    gameMenuOpenRef,
    hasActiveBattleRef,
    isCardPlayInProgressRef,
    playCardRef,
    presentationGateRef,
    screenRef,
    wakeRef,
  ]);
}
