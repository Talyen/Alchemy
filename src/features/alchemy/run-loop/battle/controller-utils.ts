import { playBattleEvent, playCardSound } from "@/lib/audio";
import { logError } from "@/lib/error-logger";
import type { CombatTextEvent } from "@/lib/battle";
import { selectCombatSound } from "./combat-sound-selection";
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

const OUTCOME_CARDS = new Set([
  "maul",
  "cinderbloom",
  "sunburst",
  "blessed-aegis",
  "molten-bulwark",
  "golden-plate",
  "spiked-shield",
  "pixie-dust",
  "shield-bash",
  "astral-arrow",
  "holy-radiance",
  "burning-blade",
  "cauterize",
  "bellows-blast",
]);

export function playResolvedCombatSound(cardId: string | undefined, events: CombatTextEvent[], deathsDoor = false) {
  if (deathsDoor) return playBattleEvent("deathsDoor");
  let sound = selectCombatSound(events, !!cardId && !OUTCOME_CARDS.has(cardId));
  if (sound === "hitCritical" && cardId === "slash") sound = "slashCritical";
  if (sound === "hitCritical" && cardId === "stab") sound = "stabCritical";
  if (cardId === "astral-arrow") {
    const astral = {
      hitBurn: "astralBurn",
      hitFreeze: "astralFreeze",
      hitPiercing: "astralPiercing",
      hitBurnCritical: "astralBurnCritical",
      hitFreezeCritical: "astralFreezeCritical",
      hitPiercingCritical: "astralPiercingCritical",
    } as const;
    if (sound && Object.hasOwn(astral, sound)) sound = astral[sound as keyof typeof astral];
  }
  if (
    cardId === "spiked-shield" &&
    sound === "enemyHit" &&
    events.some((event) => event.kind === "status" && event.stat === "thorns" && event.amount > 0)
  )
    sound = "thornsGain";
  return sound ? playBattleEvent(sound) : cardId ? playCardSound(cardId) : undefined;
}

export interface CombatTextPresenter {
  showCombatTexts: (events: CombatTextEvent[]) => void;
}

/** Single home for fight feedback: floating numbers, impact cues, and sounds. */
export function presentCombatTexts(
  presenter: CombatTextPresenter,
  combatTexts: CombatTextEvent[],
  focalSound?: string,
) {
  if (combatTexts.length === 0) return;
  presenter.showCombatTexts(combatTexts);
  playCombatTextSounds(combatTexts, focalSound);
}

export function playCombatTextSounds(combatTexts: CombatTextEvent[], focalSound?: string) {
  if (focalSound !== undefined) return;
  const sound = selectCombatSound(combatTexts, false);
  if (sound) playBattleEvent(sound);
}

export function centeredRectForSize(centerSource: CardRect, width: number, height: number): CardRect {
  return {
    x: centerSource.x + centerSource.width / 2 - width / 2,
    y: centerSource.y + centerSource.height / 2 - height / 2,
    width,
    height,
  };
}
