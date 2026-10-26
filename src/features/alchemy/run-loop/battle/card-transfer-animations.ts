import type { BattleCard } from "@/lib/game-data";
import {
  CARD_TRANSFER_CONFIG,
  GHOST_FALLBACK_CENTER_Y_RATIO,
  GHOST_FALLBACK_HEIGHT_PX,
  GHOST_FALLBACK_WIDTH_PX,
  GHOST_TARGET_Y_RATIO,
  GHOST_TRAVEL_SCALE,
  HAND_FAN_ROTATION_DEGREES,
} from "@/lib/game-constants";
import type { CardGhost, CardRect } from "../../shared/types";
import { isAnimationDisabled, shouldReduceMotion } from "@/lib/animation/animation-prefs";
import { getCardRect } from "../../shared/utils";
import type { CardTransfer } from "../../shared/types";
import {
  centeredRectForSize,
  getBattleSceneLocalRect,
  viewportRectToBattleSceneRect,
  type BattleSceneLocalRect,
} from "./controller-utils";
import { getHandCardKey } from "./playable-hand";
import type { HiddenHandCardKeys } from "./playable-hand";
import { runPlaybackTask } from "./playback-task";

export interface StableHandCardRectDeps {
  measureHandCard: (cardKey: string) => CardRect | null;
  registerCancel: (onCancel: () => void) => () => void;
  scheduleTimeout: (onTimeout: () => void, ms: number) => () => void;
}

function isRectStable(rect: CardRect | null, lastRect: CardRect | null): boolean {
  if (!rect || !lastRect) return false;
  return (
    Math.abs(rect.x - lastRect.x) < CARD_TRANSFER_CONFIG.rectEpsilonPx &&
    Math.abs(rect.y - lastRect.y) < CARD_TRANSFER_CONFIG.rectEpsilonPx &&
    Math.abs(rect.width - lastRect.width) < CARD_TRANSFER_CONFIG.rectEpsilonPx &&
    Math.abs(rect.height - lastRect.height) < CARD_TRANSFER_CONFIG.rectEpsilonPx
  );
}

export function waitForStableHandCardRect(
  cardKey: string,
  fallback: CardRect,
  deps: StableHandCardRectDeps,
): Promise<CardRect> {
  const measure = () => deps.measureHandCard(cardKey) ?? fallback;
  return runPlaybackTask(deps.registerCancel, measure, (task) => {
    let frameCount = 0;
    let stableFrames = 0;
    let lastRect: CardRect | null = null;

    task.schedule(
      (callback) => deps.scheduleTimeout(callback, CARD_TRANSFER_CONFIG.stableRectTimeoutMs),
      () => task.complete(measure()),
    );

    function tick() {
      frameCount += 1;
      const rect = deps.measureHandCard(cardKey);
      stableFrames = isRectStable(rect, lastRect) ? stableFrames + 1 : 0;
      lastRect = rect;

      if (
        stableFrames >= CARD_TRANSFER_CONFIG.requiredStableSlotFrames ||
        frameCount >= CARD_TRANSFER_CONFIG.maxSlotStabilizeFrames
      ) {
        task.complete(rect ?? fallback);
      } else {
        task.frame(tick);
      }
    }

    task.frame(tick);
  });
}

type CardTransferRunner = (transfer: Omit<CardTransfer, "id">, onComplete?: () => void) => Promise<void>;

export interface CardTransferAnimationDeps {
  isSessionActive: (session: number) => boolean;
  measureDrawPile: () => CardRect | null;
  measureDiscardPile: () => CardRect | null;
  measureHandCard: (cardKey: string) => CardRect | null;
  measureHandCardRotation: (cardKey: string) => number | null;
  runCardTransfer: CardTransferRunner;
  playTransferSound: () => void;
  setHiddenHandCardKeys: (update: (current: HiddenHandCardKeys) => Iterable<string>) => void;
  setTransferInProgress: (active: boolean) => void;
  stableHandCardDeps: StableHandCardRectDeps;
}

function transferDuration(kind: "draw" | "discard", count: number) {
  const speeds = CARD_TRANSFER_CONFIG.batchSpeedMultipliers;
  const speed =
    count <= speeds.smallMaxCardCount ? speeds.small : count <= speeds.mediumCardCount ? speeds.medium : speeds.large;
  return (kind === "draw" ? CARD_TRANSFER_CONFIG.drawDurationSec : CARD_TRANSFER_CONFIG.discardDurationSec) / speed;
}

export async function animateDiscardedHand(cards: BattleCard[], session: number, deps: CardTransferAnimationDeps) {
  if (!cards.length || shouldReduceMotion() || !deps.isSessionActive(session)) return;
  const pile = deps.measureDiscardPile();
  if (!pile || pile.width <= 0 || pile.height <= 0) return;
  deps.setTransferInProgress(true);
  for (let index = cards.length - 1; index >= 0; index--) {
    if (!deps.isSessionActive(session)) return;
    const card = cards[index]!;
    const cardKey = getHandCardKey(card, index);
    const source = deps.measureHandCard(cardKey);
    if (!source || source.width <= 0 || source.height <= 0) continue;
    const rotation =
      deps.measureHandCardRotation(cardKey) ?? (index - (cards.length - 1) / 2) * HAND_FAN_ROTATION_DEGREES;
    deps.setHiddenHandCardKeys((current) => (current.includes(cardKey) ? current : [...current, cardKey]));
    deps.playTransferSound();
    await deps.runCardTransfer({
      kind: "discard",
      card,
      handCardKey: cardKey,
      from: source,
      to: centeredRectForSize(pile, source.width, source.height),
      fromScale: 1,
      toScale: pile.width / source.width,
      toScaleY: pile.height / source.height,
      fromRotation: rotation,
      toRotation: 0,
      rotateY: [0, 180],
      duration: transferDuration("discard", cards.length),
    });
  }
}

export async function animateDrawnHand(
  cards: BattleCard[],
  allHandCards: BattleCard[],
  session: number,
  deps: CardTransferAnimationDeps,
) {
  if (!cards.length || shouldReduceMotion() || !deps.isSessionActive(session)) return;
  const pile = deps.measureDrawPile();
  for (const card of cards) {
    if (!deps.isSessionActive(session)) return;
    const identityIndex = allHandCards.indexOf(card);
    const index =
      identityIndex >= 0
        ? identityIndex
        : allHandCards.findIndex((item) => item.uid === card.uid && item.id === card.id);
    const cardKey = getHandCardKey(card, index >= 0 ? index : undefined);
    const reveal = () => deps.setHiddenHandCardKeys((current) => current.filter((key) => key !== cardKey));
    if (!pile || pile.width <= 0 || pile.height <= 0) {
      reveal();
      continue;
    }
    const fallback = centeredRectForSize(pile, pile.width, pile.height);
    const target = await waitForStableHandCardRect(cardKey, fallback, deps.stableHandCardDeps);
    if (!deps.isSessionActive(session)) return;
    if (target === fallback || target.width <= 0 || target.height <= 0) {
      reveal();
      continue;
    }
    const rotation =
      deps.measureHandCardRotation(cardKey) ??
      (Math.max(0, index) - (allHandCards.length - 1) / 2) * HAND_FAN_ROTATION_DEGREES;
    deps.playTransferSound();
    await deps.runCardTransfer(
      {
        kind: "draw",
        card,
        handCardKey: cardKey,
        from: centeredRectForSize(pile, target.width, target.height),
        to: target,
        fromScale: pile.width / target.width,
        toScale: 1,
        fromRotation: 0,
        toRotation: rotation,
        rotateY: [180, 0],
        duration: transferDuration("draw", cards.length),
      },
      reveal,
    );
  }
}

export function animateCardActivation(
  card: BattleCard,
  rect: CardRect,
  rotation: number,
  playerPanelRef: React.RefObject<HTMLDivElement | null>,
  enemyPanelRef: React.RefObject<HTMLDivElement | null>,
  battleSceneRef: React.RefObject<HTMLDivElement | null>,
  spawnCardGhost: (ghost: Omit<CardGhost, "id">) => void,
  target: "player" | "enemy",
) {
  if (isAnimationDisabled()) return;
  const sceneRect = getBattleSceneLocalRect(battleSceneRef.current);
  const localSourceRect = sceneRect ? viewportRectToBattleSceneRect(rect, sceneRect) : rect;
  const targetRect = getCardPlayGhostTargetRect(target, playerPanelRef, enemyPanelRef, battleSceneRef, sceneRect);
  if (targetRect) {
    spawnCardGhost({
      art: card.art,
      rect: localSourceRect,
      rotation,
      delay: 0,
      variant: "play-travel",
      travel: {
        x: targetRect.x + targetRect.width / 2 - (localSourceRect.x + localSourceRect.width / 2),
        y: targetRect.y + targetRect.height * GHOST_TARGET_Y_RATIO - (localSourceRect.y + localSourceRect.height / 2),
        scale: GHOST_TRAVEL_SCALE,
      },
    });
    return;
  }
  spawnCardGhost({ art: card.art, rect: localSourceRect, rotation, delay: 0, variant: "activate" });
}

function getCardPlayGhostTargetRect(
  target: "player" | "enemy",
  playerPanelRef: React.RefObject<HTMLDivElement | null>,
  enemyPanelRef: React.RefObject<HTMLDivElement | null>,
  battleSceneRef: React.RefObject<HTMLDivElement | null>,
  sceneRect: BattleSceneLocalRect | null,
) {
  const panelRect =
    target === "player"
      ? playerPanelRef.current?.getBoundingClientRect()
      : target === "enemy"
        ? enemyPanelRef.current?.getBoundingClientRect()
        : null;
  if (panelRect) {
    // Panel refs sit on the art frames themselves, so both sides land on the
    // combatant's horizontal center with no per-side fudge.
    return sceneRect ? viewportRectToBattleSceneRect(getCardRect(panelRect), sceneRect) : getCardRect(panelRect);
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
