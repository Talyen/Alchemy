import type { BattleState } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import { isAnimationDisabled } from "@/lib/animation/animation-prefs";
import { getHandCardKey } from "./playable-hand";
import { logBattleError } from "./controller-utils";
import { markBattleStage } from "@/lib/performance/battle-stage-marks";
import { EMPTY_HIDDEN_HAND_KEYS, type HiddenHandCardKeys } from "./playable-hand";

export interface HandDrawSequenceDeps {
  isSessionActive: (session: number) => boolean;
  animateDrawnHand: (cards: BattleCard[], allHandCards: BattleCard[], session: number) => Promise<void>;
  setTransferInProgress: (active: boolean) => void;
  setHiddenHandCardKeys: (update: (current: HiddenHandCardKeys) => Iterable<string>) => void;
}

function detectNewHandCards(oldHand: BattleCard[], newHand: BattleCard[]): BattleCard[] {
  const oldUidSet = new Set(oldHand.map((c) => c.uid).filter((uid): uid is number => uid !== undefined));
  let oldUndefinedRemaining = oldHand.filter((c) => c.uid === undefined).length;
  return newHand.filter((c) => {
    if (c.uid !== undefined) return !oldUidSet.has(c.uid);
    if (oldUndefinedRemaining > 0) {
      oldUndefinedRemaining -= 1;
      return false;
    }
    return true;
  });
}

function getDrawnKeys(newHand: BattleCard[], drawnCards: BattleCard[]): Set<string> {
  const drawnSet = new Set(drawnCards);
  const keys = new Set<string>();
  for (let index = 0; index < newHand.length; index++) {
    const card = newHand[index];
    if (card && drawnSet.has(card)) {
      keys.add(getHandCardKey(card, index));
    }
  }
  return keys;
}

export async function runHandDrawSequence(
  oldHand: BattleCard[],
  newState: BattleState,
  applyState: () => void,
  session: number,
  deps: HandDrawSequenceDeps,
): Promise<boolean> {
  if (!deps.isSessionActive(session)) return false;
  const drawnCards = detectNewHandCards(oldHand, newState.hand);
  if (drawnCards.length === 0) {
    if (deps.isSessionActive(session)) {
      applyState();
      deps.setTransferInProgress(false);
      deps.setHiddenHandCardKeys(() => EMPTY_HIDDEN_HAND_KEYS);
    }
    return false;
  }
  const hiddenDrawKeys = getDrawnKeys(newState.hand, drawnCards);
  deps.setTransferInProgress(true);
  markBattleStage("draw-start");
  if (deps.isSessionActive(session)) {
    deps.setHiddenHandCardKeys(() => hiddenDrawKeys);
    applyState();
  }
  await new Promise((resolve) => {
    requestAnimationFrame(resolve);
  });
  try {
    if (!isAnimationDisabled()) {
      await deps.animateDrawnHand(drawnCards, newState.hand, session);
    }
  } finally {
    markBattleStage("draw-end");
    const clearHidden = () => {
      deps.setTransferInProgress(false);
      deps.setHiddenHandCardKeys((current) => current.filter((key) => !hiddenDrawKeys.has(key)));
    };

    clearHidden();
  }
  return deps.isSessionActive(session);
}

export interface BattleDrawRequest {
  oldHand: BattleCard[];
  newState: BattleState;
  applyState: () => void;
  session: number;
  deps: HandDrawSequenceDeps;
  errorContext: string;
  onSettled?: () => void;
}

export async function runBattleDraw(request: BattleDrawRequest): Promise<boolean> {
  try {
    return await runHandDrawSequence(
      request.oldHand,
      request.newState,
      request.applyState,
      request.session,
      request.deps,
    );
  } catch (err) {
    logBattleError(request.errorContext, err);
    return false;
  } finally {
    request.onSettled?.();
  }
}
