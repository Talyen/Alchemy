import type { BattleCard } from "@/lib/game-data";
import { CARD_TRANSFER_CONFIG } from "@/lib/game-constants";
import { playBattleEvent } from "@/lib/audio";
import type { CardRect, CardTransfer } from "../../shared/types";
import { readBattle } from "../../shared/stores/run-reads";
import type { BattleControllerContext } from "./battle-context";
import type { HandDrawSequenceDeps } from "./draw-sequence";
import {
  animateDiscardedHand,
  animateDrawnHand,
  type CardTransferAnimationDeps,
  type StableHandCardRectDeps,
} from "./card-transfer-animations";

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
      let clearTimer = () => {};
      const finish = (completeTransfer: boolean) => {
        if (completed) return;
        completed = true;
        unregisterCancel();
        clearTimer();
        getPresentation().setCardTransfers((current) => current.filter((item) => item.id !== id));
        if (completeTransfer) onComplete?.();
        resolve();
      };
      unregisterCancel = ctx.playback.registerCancel(() => finish(false));
      if (completed) {
        unregisterCancel();
        return;
      }
      getPresentation().setCardTransfers((current) => [...current, { ...transfer, id }]);
      clearTimer = ctx.playback.timers.setGameTimeout(
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
    measureDiscardPile: () =>
      ctx.measureElementRect(
        ctx.discardPileRef.current?.querySelector<HTMLElement>("[data-pile-top-card]") ?? ctx.discardPileRef.current,
        scene(),
      ),
    measureDrawPile: () => ctx.measureElementRect(ctx.drawPileRef.current, scene()),
    measureHandCard,
    runCardTransfer,
    playTransferSound,
    setHiddenHandCardKeys: (update) => getPresentation().setHiddenHandCardKeys(update),
    setTransferInProgress: (active) => getPresentation().setCardTransferInProgress(active),
    stableHandCardDeps,
  };

  const drawDeps: HandDrawSequenceDeps = {
    playback: ctx.playback,
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
