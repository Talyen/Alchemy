// Computes the HomesteadEffectManifest from constructed buildings, farm plots,
// and completed research. Also provides a merge helper that folds homestead
// effects into a TalentEffectManifest for battle use.

import type { TalentEffectManifest } from "@/lib/battle";
import type { BuildingId, FarmId, HomesteadEffectManifest, ResearchId } from "./types";
import { defaultHomesteadEffects } from "./types";
import { buildings, farmPlots, researchUpgrades } from "./data";

export function computeHomesteadEffects(
  constructedBuildings: BuildingId[],
  completedResearch: ResearchId[],
): HomesteadEffectManifest {
  const effects = { ...defaultHomesteadEffects };

  for (const buildingId of constructedBuildings) {
    const building = buildings.find((b) => b.id === buildingId);
    if (!building) continue;
    switch (building.id) {
      case "workshop":
        effects.flatPhysicalDamage += 1;
        break;
      case "storehouse":
        effects.startGold += 5;
        break;
      case "stone-walls":
        effects.startBlock += 3;
        break;
      case "herb-shed":
        effects.campfireHealBonus += 0.05;
        break;
      case "watchtower":
        effects.startMaxHealthBonus += 5;
        break;
      case "smithy":
        effects.physicalCritChance += 2;
        break;
    }
  }

  for (const researchId of completedResearch) {
    const research = researchUpgrades.find((r) => r.id === researchId);
    if (!research) continue;
    switch (research.id) {
      case "carpentry":
        effects.buildingCostReduction += 0.1;
        break;
      case "masonry":
        effects.buildingCostReduction += 0.1;
        break;
      case "crop-rotation":
        effects.farmYieldMultiplier += 0.5;
        break;
      case "animal-husbandry":
        effects.farmYieldMultiplier += 0.25;
        break;
      case "fortified-walls":
        effects.startBlock += 5;
        break;
      case "metallurgy":
        effects.physicalCritChance += 2;
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
    startGold: talentEffects.startGold + homesteadEffects.startGold,
    startBlock: talentEffects.startBlock + homesteadEffects.startBlock,
    campfireHealBonus: talentEffects.campfireHealBonus + homesteadEffects.campfireHealBonus,
    physicalCritChance: talentEffects.physicalCritChance + homesteadEffects.physicalCritChance,
  };
}
