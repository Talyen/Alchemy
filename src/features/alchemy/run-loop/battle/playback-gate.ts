import { useCallback, type RefObject } from "react";
import { isPlayerDefeated, type BattleSnapshot } from "@/lib/battle";
import type { Screen } from "@/lib/routing";
import { isBattleInspectionOpen, useUiStore } from "../../shared/stores/ui-store";
import { useLatestRef } from "../../shared/ui/use-latest-ref";
import { handHasHiddenCard, type HiddenHandCardKeys } from "./playable-hand";
import type { BattlePlaybackPresentationGate } from "./presentation/use-hand-presentation";

type PlaybackMode = "card" | "wish";

interface PlaybackBlockedOptions {
  screen: Screen;
  battleState: BattleSnapshot;
  hasActiveBattle: boolean;
  cardTransferInProgress: boolean;
  hiddenHandCardKeys: HiddenHandCardKeys;
  cardPlayInProgress: boolean;
  gameMenuOpen?: boolean;
  inspectionOpen?: boolean;
}

function isPlaybackBlocked(options: PlaybackBlockedOptions, mode: PlaybackMode): boolean {
  const { battleState } = options;
  if (options.gameMenuOpen || options.inspectionOpen) return true;
  return (
    !options.hasActiveBattle ||
    options.screen !== "battle" ||
    options.cardPlayInProgress ||
    options.cardTransferInProgress ||
    handHasHiddenCard(battleState, options.hiddenHandCardKeys) ||
    battleState.turnPhase !== "player" ||
    Boolean(battleState.wishOptions) !== (mode === "wish") ||
    battleState.enemyHealth <= 0 ||
    isPlayerDefeated(battleState)
  );
}

export function isBattlePlaybackBlocked(options: PlaybackBlockedOptions): boolean {
  return isPlaybackBlocked(options, "card");
}

export function isWishPlaybackBlocked(options: PlaybackBlockedOptions): boolean {
  return isPlaybackBlocked(options, "wish");
}

interface PlaybackBlockedSource {
  screen: Screen;
  battleState: BattleSnapshot;
  hasActiveBattle: boolean;
  gameMenuOpen?: boolean;
  isCardPlayInProgress?: (() => boolean) | undefined;
  presentationGateRef: RefObject<BattlePlaybackPresentationGate>;
}

/** One live reader; an override gates a committed snapshot before React re-renders. */
export function usePlaybackBlocked(source: PlaybackBlockedSource) {
  const sourceRef = useLatestRef(source);
  return useCallback(
    (override?: BattleSnapshot, mode: PlaybackMode = "card") => {
      const current = sourceRef.current;
      return isPlaybackBlocked(
        {
          ...current,
          battleState: override ?? current.battleState,
          ...current.presentationGateRef.current,
          cardPlayInProgress: Boolean(current.isCardPlayInProgress?.()),
          inspectionOpen: isBattleInspectionOpen(useUiStore.getState()),
        },
        mode,
      );
    },
    [sourceRef],
  );
}
