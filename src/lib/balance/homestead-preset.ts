// Homestead companion bond presets for balance simulations.
import { type BattleCard, type CompanionId } from "@/lib/game-data";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import type { TalentPreset } from "./types";

const SIM_COMPANION_BOND_BY_PRESET: Record<TalentPreset, number> = {
  early: 1,
  mid: 2,
  late: 3,
};

export function companionIdsFromDeck(deck: readonly BattleCard[]): CompanionId[] {
  const ids = new Set<CompanionId>();
  for (const card of deck) {
    for (const effect of card.effects) {
      if (effect.kind === "summon-companion") {
        ids.add(effect.companionId);
      }
    }
  }
  return [...ids];
}

export function buildSimCompanionBondLevels(
  deck: readonly BattleCard[],
  preset: TalentPreset,
): Record<CompanionId, number> {
  const bondLevel = SIM_COMPANION_BOND_BY_PRESET[preset];
  const bonds = { ...defaultHomesteadEffects.companionBondLevels };
  for (const id of companionIdsFromDeck(deck)) {
    bonds[id] = bondLevel;
  }
  return bonds;
}
