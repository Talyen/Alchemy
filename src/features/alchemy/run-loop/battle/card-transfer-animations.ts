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
import { getBattleCardPlayTarget } from "@/lib/battle";
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
  measureHandDock: () => CardRect | null;
  measureHandCard: (cardKey: string) => CardRect | null;
  measureHandCardRotation: (cardKey: string) => number | null;
  waitForDeparture: (delayMs: number) => Promise<boolean>;
  runCardTransfer: CardTransferRunner;
  playTransferSound: () => void;
  setHiddenHandCardKeys: (update: (current: HiddenHandCardKeys) => Iterable<string>) => void;
  setTransferInProgress: (active: boolean) => void;
  stableHandCardDeps: StableHandCardRectDeps;
}

// A card's entire rotated silhouette starts/ends below the dock's bottom edge.
function dockCardRect(dock: CardRect, card: CardRect): CardRect {
  return {
    x: dock.x + dock.width / 2 - card.width / 2,
    y: dock.y + dock.height + Math.hypot(card.width, card.height) / 2 - card.height / 2,
    width: card.width,
    height: card.height,
  };
}

async function runTransferCascade(
  count: number,
  session: number,
  deps: CardTransferAnimationDeps,
  depart: (index: number) => Promise<void>,
) {
  const results = await Promise.allSettled(
    Array.from({ length: count }, async (_, index) => {
      if (index > 0 && !(await deps.waitForDeparture(index * CARD_TRANSFER_CONFIG.staggerMs))) return;
      if (deps.isSessionActive(session)) await depart(index);
    }),
  );
  // Keep the batch alive until every owned flight settles, including on failure.
  const failures: unknown[] = [];
  for (const result of results) if (result.status === "rejected") failures.push(result.reason);
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, "Card transfer failed");
}

export async function animateDiscardedHand(cards: BattleCard[], session: number, deps: CardTransferAnimationDeps) {
  if (cards.length === 0 || shouldReduceMotion() || !deps.isSessionActive(session)) return;
  const dock = deps.measureHandDock();
  if (!dock || dock.width <= 0) return;
  deps.setTransferInProgress(true);
  await runTransferCascade(cards.length, session, deps, async (departureIndex) => {
    const index = cards.length - 1 - departureIndex;
    const card = cards[index]!;
    const cardKey = getHandCardKey(card, index);
    const sourceRect = deps.measureHandCard(cardKey);
    if (!sourceRect || sourceRect.width <= 0) return;
    const rotation =
      deps.measureHandCardRotation(cardKey) ?? (index - (cards.length - 1) / 2) * HAND_FAN_ROTATION_DEGREES;
    deps.setHiddenHandCardKeys((current) => (current.includes(cardKey) ? current : [...current, cardKey]));
    deps.playTransferSound();
    await deps.runCardTransfer({
      kind: "discard",
      card,
      handCardKey: cardKey,
      from: sourceRect,
      to: dockCardRect(dock, sourceRect),
      fromScale: 1,
      toScale: CARD_TRANSFER_CONFIG.dockScale,
      fromRotation: rotation,
      toRotation: rotation + CARD_TRANSFER_CONFIG.clockwiseRotationDegrees,
      duration: CARD_TRANSFER_CONFIG.discardDurationSec,
    });
  });
}

export async function animateDrawnHand(
  cards: BattleCard[],
  allHandCards: BattleCard[],
  session: number,
  deps: CardTransferAnimationDeps,
) {
  if (cards.length === 0 || shouldReduceMotion() || !deps.isSessionActive(session)) return;
  const dock = deps.measureHandDock();
  if (!dock || dock.width <= 0) return;
  await runTransferCascade(cards.length, session, deps, async (index) => {
    const card = cards[index]!;
    const identityIndex = allHandCards.indexOf(card);
    const fallbackIndex = allHandCards.findIndex((item) => item.uid === card.uid && item.id === card.id);
    const resolvedIndex = identityIndex >= 0 ? identityIndex : fallbackIndex;
    const cardKey = getHandCardKey(card, resolvedIndex >= 0 ? resolvedIndex : undefined);
    const reveal = () => deps.setHiddenHandCardKeys((current) => current.filter((key) => key !== cardKey));
    const fallback = centeredRectForSize(dock, dock.width, dock.height);
    const targetRect =
      deps.measureHandCard(cardKey) ?? (await waitForStableHandCardRect(cardKey, fallback, deps.stableHandCardDeps));
    if (!deps.isSessionActive(session)) return;
    // A missing slot must not leave a committed card hidden behind a presentation failure.
    if (targetRect === fallback || targetRect.width <= 0) {
      reveal();
      return;
    }
    const rotation =
      deps.measureHandCardRotation(cardKey) ??
      (Math.max(0, resolvedIndex) - (allHandCards.length - 1) / 2) * HAND_FAN_ROTATION_DEGREES;
    deps.playTransferSound();
    await deps.runCardTransfer(
      {
        kind: "draw",
        card,
        handCardKey: cardKey,
        from: dockCardRect(dock, targetRect),
        to: targetRect,
        fromScale: CARD_TRANSFER_CONFIG.dockScale,
        toScale: 1,
        fromRotation: rotation - CARD_TRANSFER_CONFIG.clockwiseRotationDegrees,
        toRotation: rotation,
        duration: CARD_TRANSFER_CONFIG.drawDurationSec,
      },
      reveal,
    );
  });
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
  if (isAnimationDisabled()) return;
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
        y: targetRect.y + targetRect.height * GHOST_TARGET_Y_RATIO - (localSourceRect.y + localSourceRect.height / 2),
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
