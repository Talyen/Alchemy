// Computes the HomesteadEffectManifest from constructed buildings, farm plots,
// and completed research. Also provides a merge helper that folds homestead
// effects into a TalentEffectManifest for battle use.

import type { TalentEffectManifest } from "@/lib/battle";
import type { BuildingId, FarmId, HomesteadEffectManifest, ResearchId } from "./types";
import { defaultHomesteadEffects } from "./types";
import { buildings, farmPlots } from "./data";

export function computeHomesteadEffects(
  constructedBuildings: BuildingId[],
  plantedFarms: FarmId[],
  _completedResearch: ResearchId[],
): HomesteadEffectManifest {
  const effects = { ...defaultHomesteadEffects };

  for (const buildingId of constructedBuildings) {
    const building = buildings.find((b) => b.id === buildingId);
    if (!building) continue;
    switch (building.id) {
      case "blacksmiths-forge":
        effects.flatPhysicalDamage += 1;
        effects.forgeToBurn = true;
        break;
      case "hunters-lodge":
        effects.companionDamage += 1;
        break;
      case "alchemy-lab":
        effects.potionHealMultiplier += 0.2;
        effects.potionDiscount += 0.1;
        break;
    }
  }

  for (const farmId of plantedFarms) {
    const farm = farmPlots.find((f) => f.id === farmId);
    if (!farm) continue;
    switch (farm.id) {
      case "herb-garden":
        effects.potionManaBonus += 1;
        break;
    }
  }

  return effects;
}

// Merges homestead effects into a TalentEffectManifest so battle code reads
// combined bonuses from a single source.
export function mergeIntoManifest(
  talentEffects: TalentEffectManifest,
  homesteadEffects: HomesteadEffectManifest,
): TalentEffectManifest {
  return {
    ...talentEffects,
    flatPhysicalDamage: talentEffects.flatPhysicalDamage + homesteadEffects.flatPhysicalDamage,
    companionDamage: talentEffects.companionDamage + homesteadEffects.companionDamage,
    startGold: talentEffects.startGold + homesteadEffects.startGold,
    startBlock: talentEffects.startBlock + homesteadEffects.startBlock,
    campfireHealBonus: talentEffects.campfireHealBonus + homesteadEffects.campfireHealBonus,
    physicalCritChance: talentEffects.physicalCritChance + homesteadEffects.physicalCritChance,
    potionDiscount: talentEffects.potionDiscount + Math.round(homesteadEffects.potionDiscount * 100) / 100,
    potionManaBonus: talentEffects.potionManaBonus + homesteadEffects.potionManaBonus,
    forgeToBurn: talentEffects.forgeToBurn || homesteadEffects.forgeToBurn,
  };
}
