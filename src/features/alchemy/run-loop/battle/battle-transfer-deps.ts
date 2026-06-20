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
import type { RefObject } from "react";
import type { TimerGroup } from "@/lib/animation/game-timer";
import type { TransferCancelRegistry } from "./card-transfer-animations";

export function createBattleTransferDeps(params: {
  measureElementRect: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
  measureVisualCardRect: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
  battleSceneRef: RefObject<HTMLDivElement | null>;
  transferIdCounterRef: RefObject<number>;
  transferCancelRegistryRef: RefObject<TransferCancelRegistry>;
  handCardRefs: RefObject<Record<string, HTMLButtonElement | null>>;
  battleTimerGroupRef: RefObject<TimerGroup>;
  isCurrentBattleSession: (session: number) => boolean;
  discardPileRef: RefObject<HTMLDivElement | null>;
  drawPileRef: RefObject<HTMLDivElement | null>;
  cardPlayInProgressRef: RefObject<boolean>;
}) {
  const getPresentation = () => useBattlePresentationStore.getState();

  function localRectFromElement(element: HTMLElement | null): CardRect | null {
    return params.measureElementRect(element, params.battleSceneRef.current);
  }

  function localVisualCardRect(element: HTMLElement | null): CardRect | null {
    return params.measureVisualCardRect(element, params.battleSceneRef.current);
  }

  function playTransferSound(delayMs = 0) {
    const hasActiveBattle = useRunDomainStore.getState().battle.hasActiveBattle;
    if (!hasActiveBattle) return;
    playBattleEvent("drawTransfer", { volume: CARD_TRANSFER_CONFIG.soundVolume, delay: delayMs });
  }

  function runCardTransfer(transfer: Omit<CardTransfer, "id">, onComplete?: () => void): Promise<void> {
    return new Promise((resolve) => {
      params.transferIdCounterRef.current += 1;
      const id = `transfer-${params.transferIdCounterRef.current}`;
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
      unregisterCancel = params.transferCancelRegistryRef.current.register(() => finish(false));
      getPresentation().setCardTransfers([{ ...transfer, id }]);
      void delay(Math.round(transfer.duration * 1000) + CARD_TRANSFER_CONFIG.completionBufferMs).then(() =>
        finish(true),
      );
    });
  }

  function getStableHandCardDeps(): StableHandCardRectDeps {
    return {
      measureHandCard: (cardKey) => localVisualCardRect(params.handCardRefs.current[cardKey] ?? null),
      registerCancel: (callback) => params.transferCancelRegistryRef.current.register(callback),
      scheduleTimeout: (fn, ms) => params.battleTimerGroupRef.current.setTimeout(fn, ms),
    };
  }

  function getCardTransferDeps(): CardTransferAnimationDeps {
    return {
      isSessionActive: params.isCurrentBattleSession,
      measureDiscardPile: () => localRectFromElement(params.discardPileRef.current),
      measureDrawPile: () => localRectFromElement(params.drawPileRef.current),
      measureHandCard: (cardKey) => localVisualCardRect(params.handCardRefs.current[cardKey] ?? null),
      runCardTransfer,
      playTransferSound,
      setHiddenHandCardKeys: (update) => getPresentation().setHiddenHandCardKeys(update),
      revealCardKey: (cardKey) => getPresentation().addRevealedCardKey(cardKey),
      setCardPlayInProgress: (active) => {
        params.cardPlayInProgressRef.current = active;
      },
      setTransferInProgress: getPresentation().setCardTransferInProgress,
      stableHandCardDeps: getStableHandCardDeps(),
    };
  }

  function getDrawSequenceDeps(): HandDrawSequenceDeps {
    return {
      isSessionActive: params.isCurrentBattleSession,
      animateDrawnHand: (cards, allHandCards, session) =>
        animateDrawnHand(cards, allHandCards, session, getCardTransferDeps()),
      setTransferInProgress: getPresentation().setCardTransferInProgress,
      setHiddenHandCardKeys: getPresentation().setHiddenHandCardKeys,
      runIfSessionActive: (session, action) => {
        if (params.isCurrentBattleSession(session)) action();
      },
    };
  }

  return {
    getDrawSequenceDeps,
    animateDiscardedHand: (hand: import("@/lib/game-data").BattleCard[], session: number) =>
      animateDiscardedHand(hand, session, getCardTransferDeps()),
  };
}
