// Extracted utility functions for battle controller card measurement, transfer timing, and companion audio.
import { playCardSound } from "@/lib/audio";
import { CARD_TRANSFER_CONFIG, COMPANION_SOUND_CARD_IDS } from "@/lib/game-constants";
import type { CardRect } from "../types";
import { getBattleSceneLocalRect, viewportRectToBattleSceneRect } from "./card-ghost-animation";

export function playCompanionSound(companionId: string) {
  const soundCardId = COMPANION_SOUND_CARD_IDS[companionId];
  if (soundCardId) playCardSound(soundCardId);
}

export function getCardTransferBatchSpeed(cardCount: number) {
  const { batchSpeedMultipliers } = CARD_TRANSFER_CONFIG;
  if (cardCount <= batchSpeedMultipliers.smallMaxCardCount) return batchSpeedMultipliers.small;
  if (cardCount === batchSpeedMultipliers.mediumCardCount) return batchSpeedMultipliers.medium;
  return batchSpeedMultipliers.large;
}

export function defaultMeasureElementRect(
  element: HTMLElement | null,
  sceneElement: HTMLDivElement | null,
): CardRect | null {
  const sceneRect = getBattleSceneLocalRect(sceneElement);
  if (!element || !sceneRect) return null;
  const rect = element.getBoundingClientRect();
  return viewportRectToBattleSceneRect(
    { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
    sceneRect,
  );
}

export function defaultMeasureVisualCardRect(
  element: HTMLElement | null,
  sceneElement: HTMLDivElement | null,
): CardRect | null {
  const sceneRect = getBattleSceneLocalRect(sceneElement);
  if (!element || !sceneRect) return null;
  const rect = element.getBoundingClientRect();
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  return {
    x: (rect.left + rect.width / 2 - sceneRect.left) / sceneRect.scaleX - width / 2,
    y: (rect.top + rect.height / 2 - sceneRect.top) / sceneRect.scaleY - height / 2,
    width,
    height,
  };
}
