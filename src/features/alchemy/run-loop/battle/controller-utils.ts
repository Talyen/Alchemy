import { playBattleEvent, playCardSound } from "@/lib/audio";
import { logError } from "@/lib/error-logger";
import type { BattleSnapshot, CombatTextEvent } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import { CARD_TRANSFER_CONFIG, COMPANION_SOUND_CARD_IDS } from "@/lib/game-constants";
import type { CardRect } from "../../shared/types";

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

export function shouldPlayCardGoldGain(previousState: BattleSnapshot, nextState: BattleSnapshot, card: BattleCard) {
  return nextState.gold > previousState.gold && card.id !== "steal";
}

export function shouldShakeEnemyFromCombatTexts(combatTexts: CombatTextEvent[]) {
  return combatTexts.some((ct) => ct.kind === "damage" && ct.target === "enemy");
}

export function shouldShakePlayerFromCombatTexts(combatTexts: CombatTextEvent[]) {
  return combatTexts.some((ct) => ct.kind === "damage" && ct.target === "player");
}

export interface CombatTextShakeFeedback {
  shakeEnemy: () => void;
  shakePlayer: () => void;
}

export function applyCombatTextShakeFeedback(combatTexts: CombatTextEvent[], feedback: CombatTextShakeFeedback) {
  if (shouldShakeEnemyFromCombatTexts(combatTexts)) feedback.shakeEnemy();
  if (shouldShakePlayerFromCombatTexts(combatTexts)) feedback.shakePlayer();
}

export interface CombatTextPresenter extends CombatTextShakeFeedback {
  showCombatTexts: (events: CombatTextEvent[]) => void;
}

/** Single home for fight feedback: floating numbers + portrait shake + sounds. */
export function presentCombatTexts(presenter: CombatTextPresenter, combatTexts: CombatTextEvent[]) {
  if (combatTexts.length === 0) return;
  presenter.showCombatTexts(combatTexts);
  applyCombatTextShakeFeedback(combatTexts, presenter);
  playCombatTextSounds(combatTexts);
}

export function playCombatTextSounds(combatTexts: CombatTextEvent[]) {
  const sounds = new Set<Parameters<typeof playBattleEvent>[0]>();
  for (const ct of combatTexts) {
    if (ct.kind === "notice") {
      if (ct.stat === "stun") sounds.add("stunProc");
      else if (ct.stat === "freeze") sounds.add("freezeProc");
      continue;
    }
    if (ct.kind === "damage" && ct.target === "enemy") {
      sounds.add("enemyHit");
    } else if (ct.kind === "damage" && ct.target === "player" && ct.stat === "block") {
      sounds.add("blockAbsorb");
    } else if (ct.kind === "damage" && ct.target === "player") {
      sounds.add("playerHit");
    } else if (ct.kind === "heal" && ct.target === "player") {
      sounds.add("playerHeal");
    }
  }
  for (const sound of sounds) playBattleEvent(sound);
}

export function transferCardIntervalSeconds(
  durationSeconds: number,
  speedMul: number,
  completionBufferMs: number,
): number {
  return durationSeconds / speedMul + completionBufferMs / 1000;
}

export function getCardTransferBatchSpeed(cardCount: number) {
  const { batchSpeedMultipliers } = CARD_TRANSFER_CONFIG;
  if (cardCount <= batchSpeedMultipliers.smallMaxCardCount) return batchSpeedMultipliers.small;
  if (cardCount <= batchSpeedMultipliers.mediumCardCount) return batchSpeedMultipliers.medium;
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

  // Border-box layout size matches getBoundingClientRect; computed-style width
  // is content-box and would offset the center by borders/padding.
  const width = element.offsetWidth || rect.width;
  const height = element.offsetHeight || rect.height;
  return {
    x: (rect.left + rect.width / 2 - sceneRect.left) / sceneRect.scaleX - width / 2,
    y: (rect.top + rect.height / 2 - sceneRect.top) / sceneRect.scaleY - height / 2,
    width,
    height,
  };
}
