// Pure predicates for mystery choice flow (card pickers, positive SFX).
import type { MysteryChoice, MysteryEffect } from "../../mystery-events";

const POSITIVE_MYSTERY_EFFECT_KINDS = new Set<MysteryEffect["kind"]>([
  "addCard",
  "chooseCard",
  "gainTrinket",
  "gainRandomTrinket",
  "healHealth",
  "gainGold",
  "gainXP",
  "gainMaterial",
]);

/** True when any mystery effect is a net positive (card gain, heal, gold, materials, etc). */
export function hasPositiveMysteryEffect(effects: MysteryEffect[]) {
  return effects.some((e) => POSITIVE_MYSTERY_EFFECT_KINDS.has(e.kind));
}

/** True when the choice opens a card-selection picker that pauses further effect resolution. */
export function choiceOffersCardSelection(choice: MysteryChoice) {
  return choice.effects.some((e) => e.kind === "chooseCard");
}

/** True when the choice opens a remove-card picker that pauses further effect resolution. */
export function choiceRequiresCardRemoval(choice: MysteryChoice) {
  return choice.effects.some((e) => e.kind === "removeCard" && e.mode === "choose");
}
