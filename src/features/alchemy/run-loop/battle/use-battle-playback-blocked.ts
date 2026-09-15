import { useCallback, type RefObject } from "react";
import type { BattleSnapshot } from "@/lib/battle";
import type { Screen } from "@/lib/routing";
import { isBattleInspectionOpen, useUiStore } from "../../shared/stores/ui-store";
import { useLatestRef } from "../../shared/ui/use-latest-ref";
import { isBattlePlaybackBlocked, isWishPlaybackBlocked } from "./autoplay-driver";
import type { BattlePlaybackPresentationGate } from "./presentation/use-hand-presentation";

export interface PlaybackBlockedSource {
  screen: Screen;
  battleState: BattleSnapshot;
  hasActiveBattle: boolean;
  gameMenuOpen?: boolean;
  isCardPlayInProgress?: (() => boolean) | undefined;
  presentationGateRef: RefObject<BattlePlaybackPresentationGate>;
}

/**
 * Shared "can anything act right now" gate for the autoplay loop and the
 * auto-end-turn timer. Both read the same inputs through this hook so the two
 * gates cannot drift apart; each caller adds its own final check (autoplay
 * finds a playable card, auto-end-turn requires none).
 *
 * Pass an explicit battle state when gating a just-committed snapshot that the
 * component has not re-rendered with yet (e.g. right after a card play);
 * otherwise the latest render state is used. Inspection and presentation state
 * are always read live, so tight loops observe toggles without waiting for a
 * re-render.
 */
export function usePlaybackBlocked(source: PlaybackBlockedSource): (battleState?: BattleSnapshot) => boolean {
  const screenRef = useLatestRef(source.screen);
  const battleStateRef = useLatestRef(source.battleState);
  const hasActiveBattleRef = useLatestRef(source.hasActiveBattle);
  const gameMenuOpenRef = useLatestRef(source.gameMenuOpen ?? false);
  const isCardPlayInProgressRef = useLatestRef(source.isCardPlayInProgress);
  const isBlockedRef = useLatestRef((override?: BattleSnapshot) =>
    isBattlePlaybackBlocked({
      screen: screenRef.current,
      battleState: override ?? battleStateRef.current,
      hasActiveBattle: hasActiveBattleRef.current,
      cardTransferInProgress: source.presentationGateRef.current.cardTransferInProgress,
      hiddenHandCardKeys: source.presentationGateRef.current.hiddenHandCardKeys,
      cardPlayInProgress: Boolean(isCardPlayInProgressRef.current?.()),
      gameMenuOpen: gameMenuOpenRef.current,
      inspectionOpen: isBattleInspectionOpen(useUiStore.getState()),
    }),
  );
  return useCallback((override?: BattleSnapshot) => isBlockedRef.current(override), [isBlockedRef]);
}

/**
 * Wish-pick variant of the shared gate: same inputs, but Wish options must be
 * present (instead of absent) for autoplay to proceed. Lets the autoplay loop
 * resolve Wishes while the card gate and auto-end-turn timer stay parked.
 */
export function useWishPlaybackBlocked(source: PlaybackBlockedSource): (battleState?: BattleSnapshot) => boolean {
  const screenRef = useLatestRef(source.screen);
  const battleStateRef = useLatestRef(source.battleState);
  const hasActiveBattleRef = useLatestRef(source.hasActiveBattle);
  const gameMenuOpenRef = useLatestRef(source.gameMenuOpen ?? false);
  const isCardPlayInProgressRef = useLatestRef(source.isCardPlayInProgress);
  const isBlockedRef = useLatestRef((override?: BattleSnapshot) =>
    isWishPlaybackBlocked({
      screen: screenRef.current,
      battleState: override ?? battleStateRef.current,
      hasActiveBattle: hasActiveBattleRef.current,
      cardTransferInProgress: source.presentationGateRef.current.cardTransferInProgress,
      hiddenHandCardKeys: source.presentationGateRef.current.hiddenHandCardKeys,
      cardPlayInProgress: Boolean(isCardPlayInProgressRef.current?.()),
      gameMenuOpen: gameMenuOpenRef.current,
      inspectionOpen: isBattleInspectionOpen(useUiStore.getState()),
    }),
  );
  return useCallback((override?: BattleSnapshot) => isBlockedRef.current(override), [isBlockedRef]);
}
