import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useShallow } from "zustand/react/shallow";
import type { BattleSnapshot } from "@/lib/battle";
import { useStore } from "zustand";
import type { BattlePresentationStore, BattlePresentationPort } from "../battle-presentation-store";
import { getPlayableHandCardKeys } from "../playable-hand";

export function useHiddenHandCardKeys(store: BattlePresentationStore) {
  return useStore(store, (s) => s.hiddenHandCardKeys);
}

export function useCardTransferInProgress(store: BattlePresentationStore) {
  return useStore(store, (s) => s.cardTransferInProgress);
}

// Legality belongs to the engine. Memoize its complete immutable input rather than
// mirroring the engine's evolving field dependencies in presentation code.
export function useHandPresentation(store: BattlePresentationStore, battleState: BattleSnapshot) {
  const presentation = useStore(
    store,
    useShallow((state) => ({
      hiddenHandCardKeys: state.hiddenHandCardKeys,
      cardRejection: state.cardRejection,
      animationInProgress:
        state.cardTransferInProgress || state.cardTransfers.length > 0 || state.cardGhosts.length > 0,
    })),
  );
  const playableHandCardKeys = useMemo(() => getPlayableHandCardKeys(battleState), [battleState]);
  const interactiveHandCardKeys = useMemo(
    () => new Set([...playableHandCardKeys].filter((key) => !presentation.hiddenHandCardKeys.includes(key))),
    [presentation.hiddenHandCardKeys, playableHandCardKeys],
  );
  return { ...presentation, playableHandCardKeys, interactiveHandCardKeys };
}

export function useCardAnimationInProgress(store: BattlePresentationStore) {
  return useStore(
    store,
    (state) => state.cardTransferInProgress || state.cardTransfers.length > 0 || state.cardGhosts.length > 0,
  );
}

export function readCardAnimationInProgress(store: BattlePresentationStore) {
  const state = store.getState();
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

export function readPlaybackPresentationGate(store: BattlePresentationStore): BattlePlaybackPresentationGate {
  const { cardTransferInProgress, hiddenHandCardKeys } = store.getState();
  return pickPlaybackPresentationGate(cardTransferInProgress, hiddenHandCardKeys);
}

export function useBattlePresentationGateRef(
  store: BattlePresentationStore,
  onGateChangeRef?: {
    current?: (() => void) | null;
  },
): RefObject<BattlePlaybackPresentationGate> {
  const presentationGateRef = useRef(readPlaybackPresentationGate(store));

  useEffect(() => {
    presentationGateRef.current = readPlaybackPresentationGate(store);
    return store.subscribe(
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
  }, [store, onGateChangeRef]);

  return presentationGateRef;
}
