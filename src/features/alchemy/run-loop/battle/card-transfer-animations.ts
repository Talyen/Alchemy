// Hand discard and draw pile transfer animations for battle card movement.
// Depends on transfer config, card rects, and controller measurement helpers.
// Used by end-turn discard and post-resolution draw sequences.
import type { BattleCard } from "@/lib/game-data";
import { CARD_TRANSFER_CONFIG, HAND_FAN_ROTATION_DEGREES } from "@/lib/game-constants";
import type { CardRect } from "../../shared/types";
import type { CardTransfer } from "../../shared/types";
import {
  centeredRectForSize,
  getCardKey,
  getCardTransferBatchSpeed,
  transferCardIntervalSeconds,
} from "./controller-utils";
import { waitForStableHandCardRect, type StableHandCardRectDeps } from "./hand-card-layout";

type CardTransferRunner = (transfer: Omit<CardTransfer, "id">, onComplete?: () => void) => Promise<void>;

export type CardTransferAnimationDeps = {
  isSessionActive: (session: number) => boolean;
  measureDiscardPile: () => CardRect | null;
  measureDrawPile: () => CardRect | null;
  measureHandCard: (cardKey: string) => CardRect | null;
  runCardTransfer: CardTransferRunner;
  playTransferSound: (delay?: number) => void;
  setHiddenHandCardKeys: (update: (current: Set<string>) => Set<string>) => void;
  revealCardKey: (cardKey: string) => void;
  setCardPlayInProgress: (active: boolean) => void;
  setTransferInProgress: (active: boolean) => void;
  stableHandCardDeps: StableHandCardRectDeps;
};

export async function animateDiscardedHand(cards: BattleCard[], session: number, deps: CardTransferAnimationDeps) {
  const discardPileRect = deps.measureDiscardPile();
  if (!discardPileRect || cards.length === 0) return;
  const speedMul = getCardTransferBatchSpeed(cards.length);
  const cardInterval = transferCardIntervalSeconds(
    CARD_TRANSFER_CONFIG.discardDurationSeconds,
    speedMul,
    CARD_TRANSFER_CONFIG.completionBufferMs,
  );
  for (let i = 0; i < cards.length; i++) {
    if (!deps.isSessionActive(session)) return;
    deps.playTransferSound(i * cardInterval);
  }
  deps.setTransferInProgress(true);
  deps.setCardPlayInProgress(true);
  for (let index = cards.length - 1; index >= 0; index -= 1) {
    if (!deps.isSessionActive(session)) return;
    const card = cards[index];
    const cardKey = getCardKey(card);
    const sourceRect = deps.measureHandCard(cardKey);
    if (!sourceRect) continue;
    const targetRect = centeredRectForSize(discardPileRect, sourceRect.width, sourceRect.height);
    deps.setHiddenHandCardKeys((current) => new Set(current).add(cardKey));
    await deps.runCardTransfer({
      card,
      from: sourceRect,
      to: targetRect,
      fromScale: 1,
      toScale: discardPileRect.width / sourceRect.width,
      fromRotation: (index - (cards.length - 1) / 2) * HAND_FAN_ROTATION_DEGREES,
      toRotation: 0,
      rotateY: [...CARD_TRANSFER_CONFIG.discardFlipKeyframes],
      duration: CARD_TRANSFER_CONFIG.discardDurationSeconds / speedMul,
    });
  }
}

export async function animateDrawnHand(
  cards: BattleCard[],
  allHandCards: BattleCard[],
  session: number,
  deps: CardTransferAnimationDeps,
) {
  const drawPileRect = deps.measureDrawPile();
  if (!drawPileRect || cards.length === 0) return;
  const speedMul = getCardTransferBatchSpeed(cards.length);
  const cardInterval = transferCardIntervalSeconds(
    CARD_TRANSFER_CONFIG.drawDurationSeconds,
    speedMul,
    CARD_TRANSFER_CONFIG.completionBufferMs,
  );
  for (let i = 0; i < cards.length; i++) {
    if (!deps.isSessionActive(session)) return;
    deps.playTransferSound(i * cardInterval);
  }
  for (const card of cards) {
    if (!deps.isSessionActive(session)) return;
    const index = allHandCards.findIndex((item) => item.uid === card.uid && item.id === card.id);
    const cardKey = getCardKey(card);
    const fallbackRect = centeredRectForSize(drawPileRect, drawPileRect.width, drawPileRect.height);
    const targetRect = await waitForStableHandCardRect(cardKey, fallbackRect, deps.stableHandCardDeps);
    if (!deps.isSessionActive(session)) return;
    const sourceRect = centeredRectForSize(drawPileRect, targetRect.width, targetRect.height);
    await deps.runCardTransfer(
      {
        card,
        from: sourceRect,
        to: targetRect,
        fromScale: drawPileRect.width / targetRect.width,
        toScale: 1,
        fromRotation: 0,
        toRotation: (index - (allHandCards.length - 1) / 2) * HAND_FAN_ROTATION_DEGREES,
        rotateY: [...CARD_TRANSFER_CONFIG.drawFlipKeyframes],
        duration: CARD_TRANSFER_CONFIG.drawDurationSeconds / speedMul,
      },
      () => {
        deps.setHiddenHandCardKeys((current) => {
          const next = new Set(current);
          next.delete(cardKey);
          return next;
        });
        deps.revealCardKey(cardKey);
      },
    );
  }
}
