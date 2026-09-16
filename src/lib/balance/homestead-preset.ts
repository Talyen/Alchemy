import { type BattleCard, type CompanionId } from "@/lib/game-data";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import type { TalentPreset } from "./simulator-types";

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

function filledTierRecord(
  items: ReadonlyArray<{ id: string; tiers: readonly unknown[] }>,
  stars: number,
): Record<string, number> {
  const record: Record<string, number> = {};
  for (const item of items) {
    record[item.id] = Math.min(stars, item.tiers.length);
  }
  return record;
}

const TYPICAL_HOMESTEAD_CACHE: Record<TalentPreset, HomesteadEffectManifest> = {
  early: {
    ...defaultHomesteadEffects,
    companionBondLevels: { ...defaultHomesteadEffects.companionBondLevels },
    cardHealBonus: { ...defaultHomesteadEffects.cardHealBonus },
  },
  mid: computeHomesteadEffects(
    filledTierRecord(buildings, 1),
    filledTierRecord(farmPlots, 1),
    filledTierRecord(researchUpgrades, 1),
  ),
  late: computeHomesteadEffects(
    filledTierRecord(buildings, 2),
    filledTierRecord(farmPlots, 2),
    filledTierRecord(researchUpgrades, 2),
  ),
};

export function buildTypicalHomesteadEffects(preset: TalentPreset): HomesteadEffectManifest {
  // The cache template is shared: return a copy so callers can never mutate it.
  const cached = TYPICAL_HOMESTEAD_CACHE[preset];
  return {
    ...cached,
    companionBondLevels: { ...cached.companionBondLevels },
    cardHealBonus: { ...cached.cardHealBonus },
  };
}
