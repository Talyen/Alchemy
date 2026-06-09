// Assembles card-transfer and draw-sequence dependency bags for battle animations.
// Card transfers: runCardTransfer replaces the active list with one entry; callers await sequentially (no overlap).
import { delay } from "@/lib/animation/game-timer";
import { CARD_TRANSFER_CONFIG } from "@/lib/game-constants";
import { playBattleEvent } from "@/lib/audio";
import type { CardRect, CardTransfer } from "./presentation-types";
import { animateDiscardedHand, animateDrawnHand, type CardTransferAnimationDeps } from "./card-transfer-animations";
import type { HandDrawSequenceDeps } from "./draw-sequence";
import type { StableHandCardRectDeps } from "./hand-card-layout";
import { useBattlePresentationStore } from "../../shared/stores/battle-presentation-store";
import { useRunDomainStore } from "../../shared/stores/run-session-facade";
import type { BattleControllerContext } from "./controller-context";

export function createBattleTransferDeps(contextOrGetter: BattleControllerContext | (() => BattleControllerContext)) {
  const getContext = typeof contextOrGetter === "function" ? contextOrGetter : () => contextOrGetter;

  function localRectFromElement(element: HTMLElement | null): CardRect | null {
    const context = getContext();
    return context.measureElementRect(element, context.battleSceneRef.current);
  }

  function localVisualCardRect(element: HTMLElement | null): CardRect | null {
    const context = getContext();
    return context.measureVisualCardRect(element, context.battleSceneRef.current);
  }

  function playTransferSound(delayMs = 0) {
    const hasActiveBattle = useRunDomainStore.getState().battle.hasActiveBattle;
    if (!hasActiveBattle) return;
    playBattleEvent("drawTransfer", { volume: CARD_TRANSFER_CONFIG.soundVolume, delay: delayMs });
  }

  function runCardTransfer(transfer: Omit<CardTransfer, "id">, onComplete?: () => void): Promise<void> {
    return new Promise((resolve) => {
      const context = getContext();
      context.transferIdCounterRef.current += 1;
      const id = `transfer-${context.transferIdCounterRef.current}`;
      let completed = false;
      let unregisterCancel = () => {};
      const finish = (completeTransfer: boolean) => {
        if (completed) return;
        completed = true;
        unregisterCancel();
        context.setCardTransfers((current) => current.filter((item) => item.id !== id));
        if (completeTransfer) onComplete?.();
        resolve();
      };
      unregisterCancel = context.transferCancelRegistryRef.current.register(() => finish(false));
      context.setCardTransfers([{ ...transfer, id }]);
      delay(Math.round(transfer.duration * 1000) + CARD_TRANSFER_CONFIG.completionBufferMs).then(() => finish(true));
    });
  }

  function getStableHandCardDeps(): StableHandCardRectDeps {
    return {
      measureHandCard: (cardKey) => localVisualCardRect(getContext().handCardRefs.current[cardKey] ?? null),
      registerCancel: (callback) => getContext().transferCancelRegistryRef.current.register(callback),
      scheduleTimeout: (fn, ms) => getContext().battleTimerGroupRef.current.setTimeout(fn, ms),
    };
  }

  function getCardTransferDeps(): CardTransferAnimationDeps {
    const context = getContext();
    return {
      isSessionActive: context.isCurrentBattleSession,
      measureDiscardPile: () => localRectFromElement(context.discardPileRef.current),
      measureDrawPile: () => localRectFromElement(context.drawPileRef.current),
      measureHandCard: (cardKey) => localVisualCardRect(context.handCardRefs.current[cardKey] ?? null),
      runCardTransfer,
      playTransferSound,
      setHiddenHandCardKeys: (update) => context.setHiddenHandCardKeys(update),
      revealCardKey: (cardKey) => useBattlePresentationStore.getState().addRevealedCardKey(cardKey),
      setCardPlayInProgress: (active) => {
        context.cardPlayInProgressRef.current = active;
      },
      setTransferInProgress: context.setCardTransferInProgress,
      stableHandCardDeps: getStableHandCardDeps(),
    };
  }

  function getDrawSequenceDeps(): HandDrawSequenceDeps {
    return {
      isSessionActive: getContext().isCurrentBattleSession,
      animateDrawnHand: (cards, allHandCards, session) =>
        animateDrawnHand(cards, allHandCards, session, getCardTransferDeps()),
      setTransferInProgress: getContext().setCardTransferInProgress,
      setHiddenHandCardKeys: getContext().setHiddenHandCardKeys,
      runIfSessionActive: (session, action) => {
        if (getContext().isCurrentBattleSession(session)) action();
      },
    };
  }

  return {
    getDrawSequenceDeps,
    animateDiscardedHand: (hand: import("@/lib/game-data").BattleCard[], session: number) =>
      animateDiscardedHand(hand, session, getCardTransferDeps()),
  };
}
