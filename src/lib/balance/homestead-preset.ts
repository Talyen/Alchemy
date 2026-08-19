// Homestead presets for balance simulations (companion bonds + typical upgrade stars).
import { type BattleCard, type CompanionId } from "@/lib/game-data";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
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

/** Mid = 1★ every building/farm/research; late = 2★. Early stays unupgraded. */
export const TYPICAL_HOMESTEAD_STARS: Record<TalentPreset, number> = {
  early: 0,
  mid: 1,
  late: 2,
};

function filledTierRecord<T extends { id: string; tiers: readonly unknown[] }>(
  items: readonly T[],
  stars: number,
): Record<string, number> {
  const record: Record<string, number> = {};
  for (const item of items) {
    record[item.id] = Math.min(stars, item.tiers.length);
  }
  return record;
}

export function buildTypicalHomesteadEffects(preset: TalentPreset): HomesteadEffectManifest {
  const stars = TYPICAL_HOMESTEAD_STARS[preset];
  if (stars <= 0) {
    return {
      ...defaultHomesteadEffects,
      companionBondLevels: { ...defaultHomesteadEffects.companionBondLevels },
      cardHealBonus: { ...defaultHomesteadEffects.cardHealBonus },
    };
  }
  return computeHomesteadEffects(
    filledTierRecord(buildings, stars),
    filledTierRecord(farmPlots, stars),
    filledTierRecord(researchUpgrades, stars),
  );
}
