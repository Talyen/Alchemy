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
  const cardTransferInProgress = useCardTransferInProgress();
  return useMemo(
    () => getPlayableHandCardKeysExcludingHidden(battleState, hiddenHandCardKeys, cardTransferInProgress, playableKeys),
    [battleState, hiddenHandCardKeys, cardTransferInProgress, playableKeys],
  );
}
