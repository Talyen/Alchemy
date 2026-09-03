import { addInventory } from "@/lib/homestead/inventory";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { COMPANION_BOND_TIERS } from "@/lib/homestead/companions";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import { createTierLookup } from "@/lib/homestead/tiers";
import { logError } from "@/lib/error-logger";
import { defaultCompanionBondLevels } from "@/lib/game-data";
import { tryUpgradeTierItem } from "@/lib/homestead/upgrades";
import type { CompanionId } from "@/lib/game-data";
import type { BuildingId, FarmId, MaterialInventory, ResearchId } from "@/lib/homestead/types";
import type { PermanentProgressFields } from "@/features/alchemy/shared/stores/run-state-init";
import type { Draft } from "immer";

const buildingLookup = createTierLookup(buildings);
const farmLookup = createTierLookup(farmPlots);
const researchLookup = createTierLookup(researchUpgrades);

function recomputeEffects(profile: PermanentProgressFields): void {
  const pruned = Object.fromEntries(
    Object.entries(profile.bondedCompanions).filter(([key]) => key in defaultCompanionBondLevels),
  ) as Record<CompanionId, number>;
  if (Object.keys(pruned).length !== Object.keys(profile.bondedCompanions).length) {
    const removed = Object.keys(profile.bondedCompanions).filter((key) => !(key in defaultCompanionBondLevels));
    logError("Removed companions missing from catalog", "other", { removed });
    profile.bondedCompanions = pruned;
  }
  profile.effects = computeHomesteadEffects(
    profile.constructedBuildings,
    profile.plantedFarms,
    profile.completedResearch,
    profile.bondedCompanions,
  );
}

function applyTierUpgrade(
  profile: PermanentProgressFields,
  lookup: Map<string, { tiers: readonly unknown[] }>,
  levels: Record<string, number>,
  id: string,
): boolean {
  const definition = lookup.get(id) as Parameters<typeof tryUpgradeTierItem>[0] | undefined;
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
  return applyTierUpgrade(profile, buildingLookup, profile.constructedBuildings, id);
}

export function plantFarm(profile: Draft<PermanentProgressFields>, id: FarmId): boolean {
  return applyTierUpgrade(profile, farmLookup, profile.plantedFarms, id);
}

export function completeResearch(profile: Draft<PermanentProgressFields>, id: ResearchId): boolean {
  return applyTierUpgrade(profile, researchLookup, profile.completedResearch, id);
}

export function bondCompanion(profile: Draft<PermanentProgressFields>, id: CompanionId): boolean {
  const currentLevel = profile.bondedCompanions[id] ?? 0;
  const companionItem = { tiers: COMPANION_BOND_TIERS.map((cost) => ({ cost })) } as Parameters<
    typeof tryUpgradeTierItem
  >[0];
  const result = tryUpgradeTierItem(companionItem, currentLevel, profile.materialInventory);
  if (!result.ok) return false;
  profile.materialInventory = result.inventory;
  profile.bondedCompanions[id] = result.nextLevel;
  recomputeEffects(profile);
  return true;
}
