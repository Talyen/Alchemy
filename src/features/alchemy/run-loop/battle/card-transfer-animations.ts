// Card transfer animations, ghost travel, and transfer cancellation for battle UI.
import type { BattleCard } from "@/lib/game-data";
import {
  GHOST_FALLBACK_CENTER_Y_RATIO,
  GHOST_FALLBACK_HEIGHT_PX,
  GHOST_FALLBACK_WIDTH_PX,
  GHOST_PLAYER_OFFSET_RATIO,
  GHOST_TRAVEL_SCALE,
} from "@/lib/game-constants";
import type { CardGhost, CardRect } from "../../shared/types";
import { getBattleCardPlayTarget, getCardRect } from "../../shared/utils";
import { CARD_TRANSFER_CONFIG, HAND_FAN_ROTATION_DEGREES } from "@/lib/game-constants";
import type { CardTransfer } from "../../shared/types";
import {
  centeredRectForSize,
  getCardKey,
  getCardTransferBatchSpeed,
  transferCardIntervalSeconds,
  getBattleSceneLocalRect,
  viewportRectToBattleSceneRect,
  type BattleSceneLocalRect,
} from "./controller-utils";
import { waitForStableHandCardRect, type StableHandCardRectDeps } from "./hand-card-layout";

type CardTransferRunner = (transfer: Omit<CardTransfer, "id">, onComplete?: () => void) => Promise<void>;

export interface CardTransferAnimationDeps {
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
}

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
    const card = cards[index]!;
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

export interface TransferCancelRegistry {
  register: (callback: () => void) => () => void;
  cancelAll: () => void;
}

export function createTransferCancelRegistry(): TransferCancelRegistry {
  const callbacks = new Set<() => void>();
  return {
    register(callback) {
      callbacks.add(callback);
      return () => callbacks.delete(callback);
    },
    cancelAll() {
      const pendingCallbacks = Array.from(callbacks);
      callbacks.clear();
      pendingCallbacks.forEach((callback) => callback());
    },
  };
}

export function animateCardActivation(
  card: BattleCard,
  rect: CardRect,
  rotation: number,
  playerPanelRef: React.RefObject<HTMLDivElement | null>,
  enemyPanelRef: React.RefObject<HTMLDivElement | null>,
  battleSceneRef: React.RefObject<HTMLDivElement | null>,
  spawnCardGhost: (ghost: Omit<CardGhost, "id">) => void,
) {
  const sceneRect = getBattleSceneLocalRect(battleSceneRef.current);
  const localSourceRect = sceneRect ? viewportRectToBattleSceneRect(rect, sceneRect) : rect;
  const targetRect = getCardPlayGhostTargetRect(card, playerPanelRef, enemyPanelRef, battleSceneRef, sceneRect);
  if (targetRect) {
    spawnCardGhost({
      art: card.art,
      rect: localSourceRect,
      rotation,
      delay: 0,
      variant: "play-travel",
      travel: {
        x: targetRect.x + targetRect.width / 2 - (localSourceRect.x + localSourceRect.width / 2),
        y: targetRect.y + targetRect.height / 2 - (localSourceRect.y + localSourceRect.height / 2),
        scale: GHOST_TRAVEL_SCALE,
      },
    });
    return;
  }
  spawnCardGhost({ art: card.art, rect: localSourceRect, rotation, delay: 0, variant: "activate" });
}

function getCardPlayGhostTargetRect(
  card: BattleCard,
  playerPanelRef: React.RefObject<HTMLDivElement | null>,
  enemyPanelRef: React.RefObject<HTMLDivElement | null>,
  battleSceneRef: React.RefObject<HTMLDivElement | null>,
  sceneRect: BattleSceneLocalRect | null,
) {
  const target = getBattleCardPlayTarget(card);
  const panelRect =
    target === "player"
      ? playerPanelRef.current?.getBoundingClientRect()
      : target === "enemy"
        ? enemyPanelRef.current?.getBoundingClientRect()
        : null;
  if (panelRect) {
    const panelTarget = sceneRect
      ? viewportRectToBattleSceneRect(getCardRect(panelRect), sceneRect)
      : getCardRect(panelRect);
    if (target === "player") {
      return { ...panelTarget, x: panelTarget.x - panelTarget.width * GHOST_PLAYER_OFFSET_RATIO };
    }
    return panelTarget;
  }
  const battleRect = battleSceneRef.current?.getBoundingClientRect();
  if (!battleRect) return null;
  const fallback = {
    x: battleRect.left + battleRect.width / 2 - GHOST_FALLBACK_WIDTH_PX / 2,
    y: battleRect.top + battleRect.height * GHOST_FALLBACK_CENTER_Y_RATIO,
    width: GHOST_FALLBACK_WIDTH_PX,
    height: GHOST_FALLBACK_HEIGHT_PX,
  };
  return sceneRect ? viewportRectToBattleSceneRect(fallback, sceneRect) : fallback;
}
