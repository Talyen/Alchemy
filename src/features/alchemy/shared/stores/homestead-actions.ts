import { addInventory } from "@/lib/homestead/inventory";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { companionTierItems } from "@/lib/homestead/companions";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import type { TieredItem } from "@/lib/homestead/tiers";
import { logError } from "@/lib/error-logger";
import { defaultCompanionBondLevels } from "@/lib/game-data";
import { tryUpgradeTierItem } from "@/lib/homestead/upgrades";
import type { CompanionId } from "@/lib/game-data";
import type { BuildingId, FarmId, MaterialInventory, ResearchId } from "@/lib/homestead/types";
import type { PermanentProgressFields } from "@/features/alchemy/shared/stores/run-state-init";
import type { Draft } from "immer";

export function pruneUnknownCompanions(companions: Record<CompanionId, number>): Record<CompanionId, number> {
  const removed = Object.keys(companions).filter((key) => !Object.hasOwn(defaultCompanionBondLevels, key));
  if (removed.length === 0) return companions;
  logError("Removed companions missing from catalog", "other", { removed });
  return Object.fromEntries(Object.entries(companions).filter(([key]) => !removed.includes(key))) as Record<
    CompanionId,
    number
  >;
}

function recomputeEffects(profile: PermanentProgressFields): void {
  profile.bondedCompanions = pruneUnknownCompanions(profile.bondedCompanions);
  profile.effects = computeHomesteadEffects(
    profile.constructedBuildings,
    profile.plantedFarms,
    profile.completedResearch,
    profile.bondedCompanions,
  );
}

function applyTierUpgrade(
  profile: PermanentProgressFields,
  items: readonly TieredItem[],
  levels: Record<string, number>,
  id: string,
): boolean {
  const definition = items.find((item) => item.id === id);
  const result = tryUpgradeTierItem(definition, levels[id] ?? 0, profile.materialInventory);
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
  return applyTierUpgrade(profile, companionTierItems, profile.bondedCompanions, id);
}
