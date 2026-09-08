import type { BattleState } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import { isAnimationDisabled } from "@/lib/animation/animation-prefs";
import { getHandCardKey } from "./playable-hand";
import { logBattleError } from "./controller-utils";
import { markBattleStage } from "@/lib/performance/battle-stage-marks";
import { type HiddenHandCardKeys } from "./playable-hand";

export interface HandDrawSequenceDeps {
  isSessionActive: (session: number) => boolean;
  animateDrawnHand: (cards: BattleCard[], allHandCards: BattleCard[], session: number) => Promise<void>;
  setTransferInProgress: (active: boolean) => void;
  setHiddenHandCardKeys: (update: (current: HiddenHandCardKeys) => Iterable<string>) => void;
}

export type DrawStateCommit = () => void;

export const noopDrawCommit: DrawStateCommit = () => {};

const activeDraws = new WeakMap<HandDrawSequenceDeps, Map<number, number>>();

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
  applyState: DrawStateCommit,
  session: number,
  deps: HandDrawSequenceDeps,
): Promise<boolean> {
  if (!deps.isSessionActive(session)) return false;
  const drawnCards = detectNewHandCards(oldHand, newState.hand);
  if (drawnCards.length === 0) {
    if (deps.isSessionActive(session)) {
      applyState();
    }
    return false;
  }
  const hiddenDrawKeys = getDrawnKeys(newState.hand, drawnCards);
  const sessions = activeDraws.get(deps) ?? new Map<number, number>();
  activeDraws.set(deps, sessions);
  sessions.set(session, (sessions.get(session) ?? 0) + 1);
  deps.setTransferInProgress(true);
  markBattleStage("draw-start");
  try {
    deps.setHiddenHandCardKeys((current) => new Set([...current, ...hiddenDrawKeys]));
    applyState();
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
    if (!isAnimationDisabled()) {
      await deps.animateDrawnHand(drawnCards, newState.hand, session);
    }
  } finally {
    const remaining = (sessions.get(session) ?? 1) - 1;
    if (remaining > 0) sessions.set(session, remaining);
    else sessions.delete(session);
    if (deps.isSessionActive(session)) {
      markBattleStage("draw-end");
      deps.setTransferInProgress(remaining > 0);
      deps.setHiddenHandCardKeys((current) => current.filter((key) => !hiddenDrawKeys.has(key)));
    }
  }
  return deps.isSessionActive(session);
}

export interface BattleDrawRequest {
  oldHand: BattleCard[];
  newState: BattleState;
  applyState: DrawStateCommit;
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
