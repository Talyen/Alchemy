import type { AutoplayCardHandler, AutoplayWishHandler } from "./battle-context";
import { useEffect, type RefObject } from "react";

import { AUTOPLAY_POST_PLAY_DELAY_MS, AUTOPLAY_RETRY_DELAY_MS } from "@/lib/game-constants";
import type { BattleSnapshot } from "@/lib/battle";
import type { Screen } from "@/lib/routing";

import { useLatestRef } from "../../shared/ui/use-latest-ref";
import { driveAutoplay } from "./autoplay-driver";
import { usePlaybackBlocked } from "./playback-gate";
import { findBestPlayableHandCard, findBestWishChoice } from "./playable-hand";
import type { BattlePlaybackPresentationGate } from "./presentation/use-hand-presentation";

interface UseBattleAutoplayOptions {
  enabled: boolean;
  screen: Screen;
  battleState: BattleSnapshot;
  hasActiveBattle: boolean;
  isCardPlayInProgress: () => boolean;
  gameMenuOpen: boolean;
  playCard: AutoplayCardHandler;
  playWish: AutoplayWishHandler;
  presentationGateRef: RefObject<BattlePlaybackPresentationGate>;
  wakeRef?: RefObject<(() => void) | null>;
}

export function useBattleAutoplay(options: UseBattleAutoplayOptions) {
  const optionsRef = useLatestRef(options);
  const isBlocked = usePlaybackBlocked(options);
  const { enabled, wakeRef } = options;

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void driveAutoplay({
      signal: controller.signal,
      delayMs: AUTOPLAY_RETRY_DELAY_MS,
      postPlayDelayMs: AUTOPLAY_POST_PLAY_DELAY_MS,
      wakeRef,
      isEnabled: () => optionsRef.current.enabled,
      findAction: () => {
        const current = optionsRef.current;
        const mode = current.battleState.wishOptions ? "wish" : "card";
        if (isBlocked(undefined, mode)) return null;
        const canCommit = () => !isBlocked(undefined, mode);
        if (mode === "wish") {
          const card = findBestWishChoice(current.battleState);
          return card ? { canCommit, play: (control) => current.playWish(card, control) } : null;
        }
        const playable = findBestPlayableHandCard(current.battleState);
        return playable
          ? { canCommit, play: (control) => current.playCard(playable.card, playable.index, control) }
          : null;
      },
    });
    return () => controller.abort();
  }, [enabled, optionsRef, isBlocked, wakeRef]);
}
