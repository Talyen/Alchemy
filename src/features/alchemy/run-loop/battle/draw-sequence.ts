import type { BattleSnapshot } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import { isAnimationDisabled } from "@/lib/animation/animation-prefs";
import { getHandCardKey } from "./playable-hand";
import { logBattleError } from "./controller-utils";
import { markBattleStage } from "@/lib/performance/battle-stage-marks";
import { type HiddenHandCardKeys } from "./playable-hand";

import { onRunTeardown } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";

export interface HandDrawSequenceDeps {
  isSessionActive: (session: number) => boolean;
  animateDrawnHand: (cards: BattleCard[], allHandCards: BattleCard[], session: number) => Promise<void>;
  setTransferInProgress: (active: boolean) => void;
  setHiddenHandCardKeys: (update: (current: HiddenHandCardKeys) => Iterable<string>) => void;
}

export type DrawPresentationReveal = () => void;

const activeDraws = new WeakMap<HandDrawSequenceDeps, Map<number, number>>();

// Initiated card-play draws per session, owned here so input gating and the
// animation pipeline share one counter. Unlike `activeDraws` above (which only
// tracks non-empty animated draws per deps object), this counts every draw
// started through `runDrawSequenceAndFinalize`, including ones that reveal no
// new cards, and is keyed by session alone so all callers agree.
const pendingDrawCounts = new Map<number, number>();

export function getPendingDrawCount(session: number): number {
  return pendingDrawCounts.get(session) ?? 0;
}

export function incrementPendingDraw(session: number): void {
  pendingDrawCounts.set(session, (pendingDrawCounts.get(session) ?? 0) + 1);
}

export function decrementPendingDraw(session: number): number {
  const remaining = (pendingDrawCounts.get(session) ?? 1) - 1;
  if (remaining > 0) pendingDrawCounts.set(session, remaining);
  else pendingDrawCounts.delete(session);
  return remaining;
}

export function clearPendingDraws(session?: number): void {
  if (session !== undefined) pendingDrawCounts.delete(session);
  else pendingDrawCounts.clear();
}

onRunTeardown(() => {
  clearPendingDraws();
});

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
  newState: BattleSnapshot,
  onReveal: DrawPresentationReveal,
  session: number,
  deps: HandDrawSequenceDeps,
): Promise<boolean> {
  if (!deps.isSessionActive(session)) return false;
  const drawnCards = detectNewHandCards(oldHand, newState.hand);
  if (drawnCards.length === 0) {
    if (deps.isSessionActive(session)) {
      onReveal();
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
    onReveal();
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
    // Deliberately skipped when the session died mid-draw: the abandoned
    // battle tears down its UI anyway, and the next battle resets the
    // presentation store, which clears these keys.
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
  newState: BattleSnapshot;
  onReveal: DrawPresentationReveal;
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
      request.onReveal,
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
