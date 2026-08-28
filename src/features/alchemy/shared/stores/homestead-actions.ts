import { canAfford, addInventory, subtractInventory } from "@/lib/homestead/inventory";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { COMPANION_BOND_TIERS, COMPANION_MAX_TIER } from "@/lib/homestead/companions";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import { tryUpgradeTierItem } from "@/lib/homestead/upgrades";
import type { CompanionId } from "@/lib/game-data";
import type { BuildingId, FarmId, MaterialInventory, ResearchId } from "@/lib/homestead/types";
import type { PermanentProgressFields } from "@/features/alchemy/shared/stores/run-state-init";
import type { Draft } from "immer";

type TierDefinitions = ReadonlyArray<Parameters<typeof tryUpgradeTierItem>[0] & { id: string }>;

function recomputeEffects(profile: PermanentProgressFields): void {
  profile.effects = computeHomesteadEffects(
    profile.constructedBuildings,
    profile.plantedFarms,
    profile.completedResearch,
    profile.bondedCompanions,
  );
}

function applyTierUpgrade(
  profile: PermanentProgressFields,
  definitions: TierDefinitions,
  levels: Record<string, number>,
  id: string,
): boolean {
  const result = tryUpgradeTierItem(
    definitions.find((definition) => definition.id === id),
    levels[id] ?? 0,
    profile.materialInventory,
  );
  if (!result.ok) return false;
  profile.materialInventory = result.inventory;
  levels[id] = result.nextLevel;
  recomputeEffects(profile);
  return true;
}

export function addMaterials(profile: Draft<PermanentProgressFields>, materials: MaterialInventory): void {
  profile.materialInventory = addInventory(profile.materialInventory, materials);
}

export function setMaterials(profile: Draft<PermanentProgressFields>, materials: MaterialInventory): void {
  profile.materialInventory = materials;
}

export function constructBuilding(profile: Draft<PermanentProgressFields>, id: BuildingId): boolean {
  return applyTierUpgrade(profile, buildings, profile.constructedBuildings, id);
}

export function plantFarm(profile: Draft<PermanentProgressFields>, id: FarmId): boolean {
  return applyTierUpgrade(profile, farmPlots, profile.plantedFarms, id);
}

export function completeResearch(profile: Draft<PermanentProgressFields>, id: ResearchId): boolean {
  return applyTierUpgrade(profile, researchUpgrades, profile.completedResearch, id);
}

export function bondCompanion(profile: Draft<PermanentProgressFields>, id: CompanionId): boolean {
  const currentLevel = profile.bondedCompanions[id] ?? 0;
  if (currentLevel >= COMPANION_MAX_TIER) return false;
  const cost = COMPANION_BOND_TIERS[currentLevel]!;
  if (!canAfford(profile.materialInventory, cost)) return false;
  profile.materialInventory = subtractInventory(profile.materialInventory, cost);
  profile.bondedCompanions[id] = currentLevel + 1;
  recomputeEffects(profile);
  return true;
}
