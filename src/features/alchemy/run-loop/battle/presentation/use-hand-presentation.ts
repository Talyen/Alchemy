// Screen-safe presentation subscriptions for hand visibility and transfer busy.
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

export function useInteractiveHandCardKeys(battleState: BattleState) {
  const hiddenHandCardKeys = useHiddenHandCardKeys();
  const cardTransferInProgress = useCardTransferInProgress();
  return useMemo(
    () => getPlayableHandCardKeysExcludingHidden(battleState, hiddenHandCardKeys, cardTransferInProgress),
    [battleState, hiddenHandCardKeys, cardTransferInProgress],
  );
}
