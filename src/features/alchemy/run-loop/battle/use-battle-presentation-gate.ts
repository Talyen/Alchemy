// Presentation-store gate for autoplay / auto-end-turn: subscribe without re-rendering the route.
import { useEffect, useRef, type RefObject } from "react";

import type { BattlePresentationPort } from "./battle-presentation-port";
import { useBattlePresentationStore } from "./battle-presentation-store";

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
