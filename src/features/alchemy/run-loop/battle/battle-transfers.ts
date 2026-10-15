import type { BattleCard } from "@/lib/game-data";
import { CARD_TRANSFER_CONFIG } from "@/lib/game-constants";
import { playBattleEvent } from "@/lib/audio";
import type { CardRect, CardTransfer } from "../../shared/types";
import type { BattleControllerContext } from "./battle-context";
import type { HandDrawSequenceDeps } from "./draw-sequence";
import { runPlaybackTask } from "./playback-task";
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

  function createSequenceDeps(session: number) {
    const scope = ctx.playback.capture(session);
    const isActive = () => scope.isCurrent() && isCurrentBattleSession(session);
    const setHiddenHandCardKeys: CardTransferAnimationDeps["setHiddenHandCardKeys"] = (update) => {
      if (isActive()) getPresentation().setHiddenHandCardKeys(update);
    };
    const setTransferInProgress = (active: boolean) => {
      if (isActive()) getPresentation().setCardTransferInProgress(active);
    };

    function playTransferSound(delaySeconds = 0) {
      const play = () => {
        if (isActive() && ctx.battle.read().hasActiveBattle)
          playBattleEvent("drawTransfer", { volume: CARD_TRANSFER_CONFIG.soundVolume });
      };
      if (!isActive()) return;
      if (delaySeconds > 0) scope.setTimeout(play, delaySeconds * 1000);
      else play();
    }

    function runCardTransfer(transfer: Omit<CardTransfer, "id">, onComplete?: () => void): Promise<void> {
      if (!isActive()) return Promise.resolve();
      return runPlaybackTask<void>(
        scope.registerCancel,
        () => undefined,
        (task) => {
          const id = ctx.playback.nextTransferId();
          // Cancellation must remove this owned overlay even after revocation.
          // IDs are unique across generations, so this cannot clear a newer transfer.
          task.own(() => {
            getPresentation().setCardTransfers((current) => current.filter((item) => item.id !== id));
          });
          getPresentation().setCardTransfers((current) => [...current, { ...transfer, id }]);
          task.schedule(
            (callback) =>
              scope.setGameTimeout(
                callback,
                Math.round(transfer.duration * 1000) + CARD_TRANSFER_CONFIG.completionBufferMs,
              ),
            () =>
              task.complete(undefined, () => {
                if (isActive()) onComplete?.();
              }),
          );
        },
      );
    }

    const stableHandCardDeps: StableHandCardRectDeps = {
      measureHandCard: (key) => (isActive() ? measureHandCard(key) : null),
      registerCancel: scope.registerCancel,
      scheduleTimeout: scope.setTimeout,
    };

    const cardTransferDeps: CardTransferAnimationDeps = {
      isSessionActive: (id) => id === session && isActive(),
      measureDiscardPile: () =>
        isActive()
          ? ctx.measureElementRect(
              ctx.discardPileRef.current?.querySelector<HTMLElement>("[data-pile-top-card]") ??
                ctx.discardPileRef.current,
              scene(),
            )
          : null,
      measureDrawPile: () => (isActive() ? ctx.measureElementRect(ctx.drawPileRef.current, scene()) : null),
      measureHandCard: stableHandCardDeps.measureHandCard,
      runCardTransfer,
      playTransferSound,
      setHiddenHandCardKeys,
      setTransferInProgress,
      stableHandCardDeps,
    };

    const drawDeps: HandDrawSequenceDeps = {
      playback: {
        beginDraw: (id, kind) => (id === session && isActive() ? ctx.playback.beginDraw(id, kind) : () => {}),
        waitForFrame: (id) => (id === session && isActive() ? ctx.playback.waitForFrame(id) : Promise.resolve(false)),
        get pendingDraws() {
          return isActive() ? ctx.playback.pendingDraws : 0;
        },
      },
      isSessionActive: cardTransferDeps.isSessionActive,
      animateDrawnHand: (cards, allHandCards, id) => animateDrawnHand(cards, allHandCards, id, cardTransferDeps),
      setTransferInProgress,
      setHiddenHandCardKeys,
    };
    return { cardTransferDeps, drawDeps };
  }

  return {
    getDrawSequenceDeps: (session: number) => createSequenceDeps(session).drawDeps,
    animateDiscardedHand: (hand: BattleCard[], session: number) =>
      animateDiscardedHand(hand, session, createSequenceDeps(session).cardTransferDeps),
  };
}
