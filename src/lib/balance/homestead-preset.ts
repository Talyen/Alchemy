import { type BattleCard, type CompanionId } from "@/lib/game-data";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import type { TalentPreset } from "./simulator-types";
import { companionIdsFromDeck } from "./companion-deck";

export { companionIdsFromDeck } from "./companion-deck";

const SIM_COMPANION_BOND_BY_PRESET: Record<TalentPreset, number> = {
  early: 1,
  mid: 2,
  late: 3,
};

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

function homesteadTemplate(stars: number): HomesteadEffectManifest {
  return computeHomesteadEffects(
    filledTierRecord(buildings, stars),
    filledTierRecord(farmPlots, stars),
    filledTierRecord(researchUpgrades, stars),
  );
}

const TYPICAL_HOMESTEAD_CACHE: Record<TalentPreset, HomesteadEffectManifest> = {
  early: homesteadTemplate(0),
  mid: homesteadTemplate(1),
  late: homesteadTemplate(2),
};

export function buildTypicalHomesteadEffects(preset: TalentPreset): HomesteadEffectManifest {
  return structuredClone(TYPICAL_HOMESTEAD_CACHE[preset]);
}
