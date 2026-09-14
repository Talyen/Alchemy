import { useEffect, useMemo, useRef, type RefObject } from "react";
import type { BattleSnapshot } from "@/lib/battle";
import { useBattlePresentationStore, type BattlePresentationPort } from "../battle-presentation-store";
import { getPlayableHandCardKeys, getPlayableHandCardKeysExcludingHidden } from "../playable-hand";

export function useHiddenHandCardKeys() {
  return useBattlePresentationStore((s) => s.hiddenHandCardKeys);
}

export function useCardTransferInProgress() {
  return useBattlePresentationStore((s) => s.cardTransferInProgress);
}

// Playability depends on hand, mana, turn/CC state, and cost-effect slices. Depending on
// the whole snapshot would recompute on every committed tick (enemy HP, block, DoT ticks).
// Immer structural sharing keeps untouched slices referentially stable, so listing the
// inputs explicitly skips recompute when unrelated battle fields change.
export function usePlayableHandCardKeys(playabilityState: BattleSnapshot) {
  const {
    hand,
    mana,
    turnPhase,
    playerCC,
    playerStatuses,
    playerHealth,
    deathsDoorActive,
    enemyHealth,
    wishOptions,
    flags,
    talentEffects,
    trinketEffects,
    gearEffects,
    uniqueGear,
    encounterBenefits,
  } = playabilityState;
  return useMemo(
    () =>
      getPlayableHandCardKeys({
        ...playabilityState,
        hand,
        mana,
        turnPhase,
        playerCC,
        playerStatuses,
        playerHealth,
        deathsDoorActive,
        enemyHealth,
        wishOptions,
        flags,
        talentEffects,
        trinketEffects,
        gearEffects,
        uniqueGear,
        encounterBenefits,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- playabilityState spread is reconstructed from the listed slices above; listing the whole snapshot would defeat the memo.
    [
      hand,
      mana,
      turnPhase,
      playerCC,
      playerStatuses,
      playerHealth,
      deathsDoorActive,
      enemyHealth,
      wishOptions,
      flags,
      talentEffects,
      trinketEffects,
      gearEffects,
      uniqueGear,
      encounterBenefits,
    ],
  );
}

export function useInteractiveHandCardKeys(battleState: BattleSnapshot, playableKeys?: Set<string>) {
  const hiddenHandCardKeys = useHiddenHandCardKeys();
  return useMemo(() => {
    if (playableKeys) {
      const next = new Set(playableKeys);
      for (const hiddenKey of hiddenHandCardKeys) next.delete(hiddenKey);
      return next;
    }
    return getPlayableHandCardKeysExcludingHidden(battleState, hiddenHandCardKeys, playableKeys);
  }, [battleState, hiddenHandCardKeys, playableKeys]);
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
