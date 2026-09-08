import { useEffect, useMemo, useRef, type RefObject } from "react";
import type { BattleState } from "@/lib/battle";
import { useBattlePresentationStore, type BattlePresentationPort } from "../battle-presentation-store";
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

export type BattlePlaybackPresentationGate = Pick<
  BattlePresentationPort,
  "cardTransferInProgress" | "hiddenHandCardKeys"
>;

function pickPlaybackPresentationGate(
  cardTransferInProgress: boolean,
  hiddenHandCardKeys: BattlePlaybackPresentationGate["hiddenHandCardKeys"],
): BattlePlaybackPresentationGate {
  return { cardTransferInProgress, hiddenHandCardKeys };
}

export function readPlaybackPresentationGate(): BattlePlaybackPresentationGate {
  const { cardTransferInProgress, hiddenHandCardKeys } = useBattlePresentationStore.getState();
  return pickPlaybackPresentationGate(cardTransferInProgress, hiddenHandCardKeys);
}

export function useBattlePresentationGateRef(onGateChangeRef?: {
  current?: (() => void) | null;
}): RefObject<BattlePlaybackPresentationGate> {
  const presentationGateRef = useRef(readPlaybackPresentationGate());

  useEffect(() => {
    presentationGateRef.current = readPlaybackPresentationGate();
    return useBattlePresentationStore.subscribe(
      (state) => pickPlaybackPresentationGate(state.cardTransferInProgress, state.hiddenHandCardKeys),
      (gate) => {
        presentationGateRef.current = gate;
        onGateChangeRef?.current?.();
      },
      {
        equalityFn: (a, b) =>
          a.cardTransferInProgress === b.cardTransferInProgress && a.hiddenHandCardKeys === b.hiddenHandCardKeys,
      },
    );
  }, [onGateChangeRef]);

  return presentationGateRef;
}
