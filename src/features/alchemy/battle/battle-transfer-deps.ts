// Assembles card-transfer and draw-sequence dependency bags for battle animations.
// Card transfers: runCardTransfer replaces the active list with one entry; callers await sequentially (no overlap).
import type { RefObject } from "react";
import { delay } from "@/lib/animation/game-timer";
import { CARD_TRANSFER_CONFIG } from "@/lib/game-constants";
import { playBattleEvent } from "@/lib/audio";
import type { CardRect, CardTransfer } from "../types";
import { useBattleStore } from "../stores/battle-store";
import { animateDiscardedHand, animateDrawnHand, type CardTransferAnimationDeps } from "./card-transfer-animations";
import type { HandDrawSequenceDeps } from "./draw-sequence";
import type { StableHandCardRectDeps } from "./hand-card-layout";

export type BattleTransferDepsInput = {
  battleSessionRef: RefObject<number>;
  battleSceneRef: RefObject<HTMLDivElement | null>;
  handCardRefs: RefObject<Record<string, HTMLButtonElement | null>>;
  drawPileRef: RefObject<HTMLDivElement | null>;
  discardPileRef: RefObject<HTMLDivElement | null>;
  cardPlayInProgressRef: RefObject<boolean>;
  transferIdCounterRef: RefObject<number>;
  measureElementRect: (element: HTMLElement | null, scene: HTMLDivElement | null) => CardRect | null;
  measureVisualCardRect: (element: HTMLElement | null, scene: HTMLDivElement | null) => CardRect | null;
  isCurrentBattleSession: (session: number) => boolean;
  registerTransferCancelCallback: (callback: () => void) => () => void;
  battleTimerGroupRef: RefObject<import("@/lib/animation/game-timer").TimerGroup>;
  setCardTransfers: React.Dispatch<React.SetStateAction<CardTransfer[]>>;
  setHiddenHandCardKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  setCardTransferInProgress: React.Dispatch<React.SetStateAction<boolean>>;
};

export function createBattleTransferDeps(input: BattleTransferDepsInput) {
  const getStore = () => useBattleStore.getState();

  function localRectFromElement(element: HTMLElement | null): CardRect | null {
    return input.measureElementRect(element, input.battleSceneRef.current);
  }

  function localVisualCardRect(element: HTMLElement | null): CardRect | null {
    return input.measureVisualCardRect(element, input.battleSceneRef.current);
  }

  function playTransferSound(delayMs = 0) {
    if (!getStore().hasActiveBattle) return;
    playBattleEvent("drawTransfer", { volume: CARD_TRANSFER_CONFIG.soundVolume, delay: delayMs });
  }

  function runCardTransfer(transfer: Omit<CardTransfer, "id">, onComplete?: () => void): Promise<void> {
    return new Promise((resolve) => {
      input.transferIdCounterRef.current += 1;
      const id = `transfer-${input.transferIdCounterRef.current}`;
      let completed = false;
      let unregisterCancel = () => {};
      const finish = (completeTransfer: boolean) => {
        if (completed) return;
        completed = true;
        unregisterCancel();
        input.setCardTransfers((current) => current.filter((item) => item.id !== id));
        if (completeTransfer) onComplete?.();
        resolve();
      };
      unregisterCancel = input.registerTransferCancelCallback(() => finish(false));
      input.setCardTransfers([{ ...transfer, id }]);
      delay(Math.round(transfer.duration * 1000) + CARD_TRANSFER_CONFIG.completionBufferMs).then(() => finish(true));
    });
  }

  function getStableHandCardDeps(): StableHandCardRectDeps {
    return {
      measureHandCard: (cardKey) => localVisualCardRect(input.handCardRefs.current[cardKey] ?? null),
      registerCancel: input.registerTransferCancelCallback,
      scheduleTimeout: (fn, ms) => input.battleTimerGroupRef.current.setTimeout(fn, ms),
    };
  }

  function getCardTransferDeps(): CardTransferAnimationDeps {
    return {
      isSessionActive: input.isCurrentBattleSession,
      measureDiscardPile: () => localRectFromElement(input.discardPileRef.current),
      measureDrawPile: () => localRectFromElement(input.drawPileRef.current),
      measureHandCard: (cardKey) => localVisualCardRect(input.handCardRefs.current[cardKey] ?? null),
      runCardTransfer,
      playTransferSound,
      setHiddenHandCardKeys: (update) => input.setHiddenHandCardKeys(update),
      revealCardKey: (cardKey) => getStore().addRevealedCardKey(cardKey),
      setCardPlayInProgress: (active) => {
        input.cardPlayInProgressRef.current = active;
      },
      setTransferInProgress: input.setCardTransferInProgress,
      stableHandCardDeps: getStableHandCardDeps(),
    };
  }

  function getDrawSequenceDeps(): HandDrawSequenceDeps {
    return {
      isSessionActive: input.isCurrentBattleSession,
      animateDrawnHand: (cards, allHandCards, session) =>
        animateDrawnHand(cards, allHandCards, session, getCardTransferDeps()),
      setTransferInProgress: input.setCardTransferInProgress,
      setHiddenHandCardKeys: input.setHiddenHandCardKeys,
      runIfSessionActive: (session, action) => {
        if (input.isCurrentBattleSession(session)) action();
      },
    };
  }

  return {
    getDrawSequenceDeps,
    animateDiscardedHand: (hand: import("@/lib/game-data").BattleCard[], session: number) =>
      animateDiscardedHand(hand, session, getCardTransferDeps()),
  };
}
