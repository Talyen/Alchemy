import { playBattleEvent, playCardSound } from "@/lib/audio";
import { logError } from "@/lib/error-logger";
import type { CombatTextEvent } from "@/lib/battle";
import { CARD_TRANSFER_CONFIG, COMPANION_SOUND_CARD_IDS } from "@/lib/game-constants";
import type { CardRect } from "../../shared/types";

export { getHandCardKey as getCardKey } from "./playable-hand";

export function logBattleError(context: string, err: unknown): void {
  logError(`Failed to ${context}`, "battle", { error: String(err) }, err instanceof Error ? err.stack : undefined);
}

export interface BattleSceneLocalRect {
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
}

export function getBattleSceneLocalRect(scene: HTMLDivElement | null): BattleSceneLocalRect | null {
  if (!scene) return null;
  const rect = scene.getBoundingClientRect();
  const scaleX = rect.width / scene.offsetWidth;
  const scaleY = rect.height / scene.offsetHeight;
  if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX === 0 || scaleY === 0) return null;
  return { left: rect.left, top: rect.top, scaleX, scaleY };
}

export function viewportRectToBattleSceneRect(rect: CardRect, sceneRect: BattleSceneLocalRect): CardRect {
  return {
    x: (rect.x - sceneRect.left) / sceneRect.scaleX,
    y: (rect.y - sceneRect.top) / sceneRect.scaleY,
    width: rect.width / sceneRect.scaleX,
    height: rect.height / sceneRect.scaleY,
  };
}

export function playCompanionSound(companionId: string) {
  const soundCardId = COMPANION_SOUND_CARD_IDS[companionId];
  if (soundCardId) playCardSound(soundCardId);
}

export function playCombatTextSounds(combatTexts: CombatTextEvent[]) {
  for (const ct of combatTexts) {
    if (ct.kind === "notice") {
      if (ct.stat === "stun") playBattleEvent("stunProc");
      else if (ct.stat === "freeze") playBattleEvent("freezeProc");
      continue;
    }
    if (ct.kind === "damage" && ct.target === "enemy") {
      playBattleEvent("enemyHit");
    } else if (ct.kind === "damage" && ct.target === "player" && ct.stat === "block") {
      playBattleEvent("blockAbsorb");
    } else if (ct.kind === "damage" && ct.target === "player") {
      playBattleEvent("playerHit");
    } else if (ct.kind === "heal" && ct.target === "player") {
      playBattleEvent("playerHeal");
    }
  }
}

export function transferCardIntervalSeconds(
  durationSeconds: number,
  speedMul: number,
  completionBufferMs: number,
): number {
  return ((durationSeconds / speedMul) * 1000 + completionBufferMs) / 1000;
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

export function centeredRectForSize(centerSource: CardRect, width: number, height: number): CardRect {
  return {
    x: centerSource.x + centerSource.width / 2 - width / 2,
    y: centerSource.y + centerSource.height / 2 - height / 2,
    width,
    height,
  };
}

export function defaultMeasureVisualCardRect(
  element: HTMLElement | null,
  sceneElement: HTMLDivElement | null,
): CardRect | null {
  const sceneRect = getBattleSceneLocalRect(sceneElement);
  if (!element || !sceneRect) return null;
  const rect = element.getBoundingClientRect();
  const computedStyle = getComputedStyle(element);

  const width = Number.parseFloat(computedStyle.width) || element.offsetWidth;
  const height = Number.parseFloat(computedStyle.height) || element.offsetHeight;
  return {
    x: (rect.left + rect.width / 2 - sceneRect.left) / sceneRect.scaleX - width / 2,
    y: (rect.top + rect.height / 2 - sceneRect.top) / sceneRect.scaleY - height / 2,
    width,
    height,
  };
}
