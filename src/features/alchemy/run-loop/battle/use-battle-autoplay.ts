import type { AutoplayCardHandler } from "./battle-context";
import { useEffect, type RefObject } from "react";

import { AUTOPLAY_POST_PLAY_DELAY_MS, AUTOPLAY_RETRY_DELAY_MS } from "@/lib/game-constants";
import type { BattleSnapshot } from "@/lib/battle";
import type { Screen } from "@/lib/routing";

import { useLatestRef } from "../../shared/ui/use-latest-ref";
import { driveAutoplay } from "./autoplay-driver";
import { findFirstPlayableHandCard } from "./playable-hand";
import { usePlaybackBlocked } from "./use-battle-playback-blocked";
import type { BattlePlaybackPresentationGate } from "./presentation/use-hand-presentation";

interface UseBattleAutoplayOptions {
  enabled: boolean;
  screen: Screen;
  battleState: BattleSnapshot;
  hasActiveBattle: boolean;
  isCardPlayInProgress: () => boolean;
  gameMenuOpen: boolean;
  playCard: AutoplayCardHandler;
  presentationGateRef: RefObject<BattlePlaybackPresentationGate>;
  wakeRef?: RefObject<(() => void) | null>;
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
  const enabledRef = useLatestRef(enabled);
  const playCardRef = useLatestRef(playCard);
  const isBlocked = usePlaybackBlocked({
    screen,
    battleState,
    hasActiveBattle,
    gameMenuOpen,
    isCardPlayInProgress,
    presentationGateRef,
  });

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void driveAutoplay({
      signal: controller.signal,
      delayMs: AUTOPLAY_RETRY_DELAY_MS,
      postPlayDelayMs: AUTOPLAY_POST_PLAY_DELAY_MS,
      wakeRef,
      isEnabled: () => enabledRef.current && !controller.signal.aborted,
      isBlocked,
      findPlayableCard: () => findFirstPlayableHandCard(battleStateRef.current),
      playCard: (card, index, control) => playCardRef.current(card, index, control),
    });
    return () => controller.abort();
  }, [enabled, battleStateRef, enabledRef, isBlocked, playCardRef, wakeRef]);
}
