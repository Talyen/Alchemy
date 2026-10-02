import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useShallow } from "zustand/react/shallow";
import type { BattleSnapshot } from "@/lib/battle";
import { useBattlePresentationStore } from "../battle-presentation-store";
import { getPlayableHandCardKeys } from "../playable-hand";

export function useHiddenHandCardKeys() {
  return useBattlePresentationStore((s) => s.hiddenHandCardKeys);
}

export function useCardTransferInProgress() {
  return useBattlePresentationStore((s) => s.cardTransferInProgress);
}

// Legality belongs to the engine. Memoize its complete immutable input rather than
// mirroring the engine's evolving field dependencies in presentation code.
export function useHandPresentation(battleState: BattleSnapshot) {
  const presentation = useBattlePresentationStore(
    useShallow((state) => ({
      hiddenHandCardKeys: state.hiddenHandCardKeys,
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
  ReturnType<typeof useBattlePresentationStore.getState>,
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
