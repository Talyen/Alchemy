import { useMemo } from "react";
import type { BattleState } from "@/lib/battle";
import { useBattlePresentationStore } from "../battle-presentation-store";
import { getPlayableHandCardKeysExcludingHidden } from "../playable-hand";

export function useHiddenHandCardKeys() {
  return useBattlePresentationStore((s) => s.hiddenHandCardKeys);
}

export function useCardTransferInProgress() {
  return useBattlePresentationStore((s) => s.cardTransferInProgress);
}

export function useInteractiveHandCardKeys(battleState: BattleState, playableKeys?: Set<string>) {
  const hiddenHandCardKeys = useHiddenHandCardKeys();
  return useMemo(
    () => getPlayableHandCardKeysExcludingHidden(battleState, hiddenHandCardKeys, playableKeys),
    [battleState, hiddenHandCardKeys, playableKeys],
  );
}

export function useCardAnimationInProgress() {
  return useBattlePresentationStore(
    (state) => state.cardTransferInProgress || state.cardTransfers.length > 0 || state.cardGhosts.length > 0,
  );
}

export function readCardAnimationInProgress() {
  const state = useBattlePresentationStore.getState();
  return state.cardTransferInProgress || state.cardTransfers.length > 0 || state.cardGhosts.length > 0;
}
