import { playBattleEvent, playCardSound } from "@/lib/audio";
import { logError } from "@/lib/error-logger";
import type { CombatTextEvent } from "@/lib/battle";
import { selectCombatSound } from "./combat-sound-selection";
import { COMPANION_SOUND_CARD_IDS } from "@/lib/game-constants";
import type { CardRect } from "../../shared/types";

export function logBattleError(context: string, err: unknown): void {
  logError(`Failed to ${context}`, "battle", { error: String(err) }, err instanceof Error ? err.stack : undefined);
}

export {
  getBattleSceneLocalRect,
  viewportRectToBattleSceneRect,
  defaultMeasureElementRect,
  defaultMeasureVisualCardRect,
  type BattleSceneLocalRect,
} from "./presentation/scene-geometry";

export function playCompanionSound(companionId: string) {
  const soundCardId = COMPANION_SOUND_CARD_IDS[companionId];
  return soundCardId ? playCardSound(soundCardId) : undefined;
}

export interface CombatTextPresenter {
  showCombatTexts: (events: CombatTextEvent[]) => void;
  shakeEnemy: () => void;
  shakePlayer: () => void;
}

/** Single home for fight feedback: floating numbers + portrait shake + sounds. */
export function presentCombatTexts(
  presenter: CombatTextPresenter,
  combatTexts: CombatTextEvent[],
  focalSound?: string,
) {
  if (combatTexts.length === 0) return;
  presenter.showCombatTexts(combatTexts);
  if (combatTexts.some((ct) => ct.kind === "damage" && ct.amount > 0 && ct.impact !== false && ct.target === "enemy"))
    presenter.shakeEnemy();
  if (combatTexts.some((ct) => ct.kind === "damage" && ct.amount > 0 && ct.impact !== false && ct.target === "player"))
    presenter.shakePlayer();
  playCombatTextSounds(combatTexts, focalSound);
}

export function playCombatTextSounds(combatTexts: CombatTextEvent[], focalSound?: string) {
  const sound = selectCombatSound(combatTexts, focalSound !== undefined);
  if (sound) playBattleEvent(sound, focalSound === undefined ? {} : { excludeSound: focalSound });
}

export function centeredRectForSize(centerSource: CardRect, width: number, height: number): CardRect {
  return {
    x: centerSource.x + centerSource.width / 2 - width / 2,
    y: centerSource.y + centerSource.height / 2 - height / 2,
    width,
    height,
  };
}
