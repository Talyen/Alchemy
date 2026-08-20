// Pure predicates for mystery choice flow (card pickers, positive SFX).
import type { MysteryChoice, MysteryEffect } from "@/lib/mystery";

const POSITIVE_MYSTERY_EFFECT_KINDS = new Set<MysteryEffect["kind"]>([
  "addCard",
  "chooseCard",
  "gainTrinket",
  "gainRandomTrinket",
  "gainGeneratedGear",
  "healHealth",
  "gainGold",
  "gainXP",
  "gainMaterial",
]);

/** True when a mystery effect is a net positive (card gain, heal, gold, materials, etc). */
export function hasPositiveMysteryEffect(effects: MysteryEffect[]) {
  return effects.some((e) => POSITIVE_MYSTERY_EFFECT_KINDS.has(e.kind));
}

/** True when the choice opens a card-selection picker that pauses further effect resolution. */
export function choiceOffersCardSelection(choice: MysteryChoice) {
  return choice.effects.some((e) => e.kind === "chooseCard");
}

export function choiceHasDisplayableSummary(choice: MysteryChoice): boolean {
  return choice.effects.some((effect) => effect.kind !== "removeCard");
}
