// Whether homestead has any affordable upgrade for the menu badge.
import { cardLibrary, type CompanionId } from "@/lib/game-data";
import { buildings, visibleFarmPlots, researchUpgrades } from "@/lib/homestead/data";
import { COMPANION_BOND_TIERS, COMPANION_MAX_TIER } from "@/lib/homestead/companions";
import { canAfford } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";

interface HomesteadAffordabilityInput {
  materialInventory: MaterialInventory;
  constructedBuildings: Record<string, number>;
  plantedFarms: Record<string, number>;
  completedResearch: Record<string, number>;
  bondedCompanions: Record<string, number>;
  discoveredCardIds: string[];
}

export function hasAffordableHomesteadUpgrade(input: HomesteadAffordabilityInput): boolean {
  const {
    materialInventory,
    constructedBuildings,
    plantedFarms,
    completedResearch,
    bondedCompanions,
    discoveredCardIds,
  } = input;

  const affordableBuilding = buildings.some((b) => {
    const currentLevel = constructedBuildings[b.id] ?? 0;
    if (currentLevel >= b.tiers.length) return false;
    const tier = b.tiers[currentLevel];
    if (!tier) return false;
    return canAfford(materialInventory, tier.cost);
  });

  const affordableFarm = visibleFarmPlots.some((f) => {
    const currentLevel = plantedFarms[f.id] ?? 0;
    if (currentLevel >= f.tiers.length) return false;
    const tier = f.tiers[currentLevel];
    if (!tier) return false;
    return canAfford(materialInventory, tier.cost);
  });

  const affordableResearch = researchUpgrades.some((r) => {
    const currentLevel = completedResearch[r.id] ?? 0;
    if (currentLevel >= r.tiers.length) return false;
    const tier = r.tiers[currentLevel];
    if (!tier) return false;
    return canAfford(materialInventory, tier.cost);
  });

  const affordableBond = cardLibrary.some((c) => {
    const effect = c.effects.find(
      (e): e is { kind: "summon-companion"; companionId: CompanionId } => e.kind === "summon-companion",
    );
    if (!effect) return false;
    if (!discoveredCardIds.includes(c.id)) return false;
    const currentLevel = bondedCompanions[effect.companionId] ?? 0;
    if (currentLevel >= COMPANION_MAX_TIER) return false;
    const bondTier = COMPANION_BOND_TIERS[currentLevel];
    if (!bondTier) return false;
    return canAfford(materialInventory, bondTier);
  });

  return affordableBuilding || affordableFarm || affordableResearch || affordableBond;
}
