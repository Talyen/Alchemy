import type { BattleSnapshot } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import { isAnimationDisabled } from "@/lib/animation/animation-prefs";
import { CARD_TRANSFER_CONFIG } from "@/lib/game-constants";
import { playBattleEvent } from "@/lib/audio";
import { getHandCardKey } from "./playable-hand";
import { logBattleError } from "./controller-utils";
import { markBattleStage } from "@/lib/performance/battle-stage-marks";
import { type HiddenHandCardKeys } from "./playable-hand";
import {
  animateDiscardedHand,
  animateDrawnHand,
  type CardTransferAnimationDeps,
  type StableHandCardRectDeps,
} from "./card-transfer-animations";
import type { CardRect, CardTransfer } from "../../shared/types";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import type { BattleControllerContext } from "./battle-context";

export interface HandDrawSequenceDeps {
  beginDraw: (session: number) => () => void;
  isSessionActive: (session: number) => boolean;
  animateDrawnHand: (cards: BattleCard[], allHandCards: BattleCard[], session: number) => Promise<void>;
  setTransferInProgress: (active: boolean) => void;
  setHiddenHandCardKeys: (update: (current: HiddenHandCardKeys) => Iterable<string>) => void;
}

export type DrawPresentationReveal = () => void;

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
  const finishInitiatedDraw = request.deps.beginDraw(request.session);
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
    finishInitiatedDraw();
    request.onSettled?.();
  }
}

// Battle transfer wiring, colocated with the draw pipeline that consumes it
// (previously battle-transfer-deps.ts). Builds the card-transfer deps from
// controller refs plus the draw-sequence deps derived from them.
export function createBattleTransferDeps(
  ctx: BattleControllerContext,
  isCurrentBattleSession: (session: number) => boolean,
) {
  const getPresentation = () => ctx.getPresentation();
  const scene = () => ctx.battleSceneRef.current;
  const measureHandCard = (cardKey: string): CardRect | null =>
    ctx.measureVisualCardRect(ctx.handCardRefs.current[cardKey] ?? null, scene());

  function playTransferSound(delaySeconds = 0) {
    const hasActiveBattle = readBattle().hasActiveBattle;
    if (!hasActiveBattle) return;
    playBattleEvent("drawTransfer", { volume: CARD_TRANSFER_CONFIG.soundVolume, delay: delaySeconds });
  }

  function runCardTransfer(transfer: Omit<CardTransfer, "id">, onComplete?: () => void): Promise<void> {
    return new Promise((resolve) => {
      const id = ctx.playback.nextTransferId();
      let completed = false;
      let unregisterCancel = () => {};
      const finish = (completeTransfer: boolean) => {
        if (completed) return;
        completed = true;
        unregisterCancel();
        getPresentation().setCardTransfers((current) => current.filter((item) => item.id !== id));
        if (completeTransfer) onComplete?.();
        resolve();
      };
      unregisterCancel = ctx.playback.registerCancel(() => finish(false));
      getPresentation().setCardTransfers((current) => [...current, { ...transfer, id }]);
      ctx.playback.timers.setGameTimeout(
        () => finish(true),
        Math.round(transfer.duration * 1000) + CARD_TRANSFER_CONFIG.completionBufferMs,
      );
    });
  }

  const stableHandCardDeps: StableHandCardRectDeps = {
    measureHandCard,
    registerCancel: (callback) => ctx.playback.registerCancel(callback),
    scheduleTimeout: (fn, ms) => ctx.playback.timers.setTimeout(fn, ms),
  };

  const cardTransferDeps: CardTransferAnimationDeps = {
    isSessionActive: isCurrentBattleSession,
    measureDiscardPile: () => ctx.measureElementRect(ctx.discardPileRef.current, scene()),
    measureDrawPile: () => ctx.measureElementRect(ctx.drawPileRef.current, scene()),
    measureHandCard,
    runCardTransfer,
    playTransferSound,
    setHiddenHandCardKeys: (update) => getPresentation().setHiddenHandCardKeys(update),
    setTransferInProgress: (active) => getPresentation().setCardTransferInProgress(active),
    stableHandCardDeps,
  };

  const drawDeps: HandDrawSequenceDeps = {
    beginDraw: (id) => ctx.playback.beginDraw(id),
    isSessionActive: isCurrentBattleSession,
    animateDrawnHand: (cards, allHandCards, session) =>
      animateDrawnHand(cards, allHandCards, session, cardTransferDeps),
    setTransferInProgress: (active) => getPresentation().setCardTransferInProgress(active),
    setHiddenHandCardKeys: (update) => getPresentation().setHiddenHandCardKeys(update),
  };

  return {
    getDrawSequenceDeps: () => drawDeps,
    animateDiscardedHand: (hand: BattleCard[], session: number) =>
      animateDiscardedHand(hand, session, cardTransferDeps),
  };
}
