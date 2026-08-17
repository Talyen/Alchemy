// Presentation-boundary autoplay: plays hand cards through the same path as a click.
import { useEffect } from "react";

import { AUTOPLAY_POST_PLAY_DELAY_MS, AUTOPLAY_RETRY_DELAY_MS } from "@/lib/game-constants";
import type { BattleState } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import type { Screen } from "@/lib/routing";

import { useLatestRef } from "../../shared/hooks";
import { driveAutoplay, findFirstPlayableHandCard, isAutoplayBattleOver } from "./autoplay-driver";

interface UseBattleAutoplayOptions {
  enabled: boolean;
  screen: Screen;
  battleState: BattleState;
  hasActiveBattle: boolean;
  cardTransferInProgress: boolean;
  hiddenHandCardKeys: Set<string>;
  isCardPlayInProgress: () => boolean;
  gameMenuOpen: boolean;
  playCard: (card: BattleCard, index: number) => boolean;
}

export function isAutoplayBlocked(options: {
  screen: Screen;
  battleState: BattleState;
  hasActiveBattle: boolean;
  cardTransferInProgress: boolean;
  hiddenHandCardKeys: Set<string>;
  cardPlayInProgress: boolean;
  gameMenuOpen: boolean;
}): boolean {
  if (!options.hasActiveBattle || options.screen !== "battle") return true;
  if (options.gameMenuOpen) return true;
  if (options.cardPlayInProgress || options.cardTransferInProgress) return true;
  if (options.hiddenHandCardKeys.size > 0) return true;
  if (options.battleState.turnPhase !== "player") return true;
  if (options.battleState.wishOptions) return true;
  if (isAutoplayBattleOver(options.battleState)) return true;
  return false;
}

export function useBattleAutoplay({
  enabled,
  screen,
  battleState,
  hasActiveBattle,
  cardTransferInProgress,
  hiddenHandCardKeys,
  isCardPlayInProgress,
  gameMenuOpen,
  playCard,
}: UseBattleAutoplayOptions) {
  const battleStateRef = useLatestRef(battleState);
  const blockedRef = useLatestRef(
    isAutoplayBlocked({
      screen,
      battleState,
      hasActiveBattle,
      cardTransferInProgress,
      hiddenHandCardKeys,
      cardPlayInProgress: false,
      gameMenuOpen,
    }),
  );
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
      isEnabled: () => enabledRef.current && !controller.signal.aborted,
      isBlocked: () => blockedRef.current || isCardPlayInProgressRef.current(),
      findPlayableCard: () => findFirstPlayableHandCard(battleStateRef.current),
      playCard: (card, index) => playCardRef.current(card, index),
    });
    return () => controller.abort();
  }, [enabled, battleStateRef, blockedRef, enabledRef, isCardPlayInProgressRef, playCardRef]);
}
