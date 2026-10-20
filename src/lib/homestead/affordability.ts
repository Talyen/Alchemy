import { canBondCompanion, companionTierItems } from "./companions";
import { buildings, farmPlots, researchUpgrades } from "./data";
import type { MaterialInventory } from "./types";
import { canUpgradeTierItem } from "./upgrades";

/** Menu-badge predicate shared with the Homestead purchase rules. */
export function hasAffordableHomesteadUpgrade(input: {
  materialInventory: MaterialInventory;
  constructedBuildings: Record<string, number>;
  plantedFarms: Record<string, number>;
  completedResearch: Record<string, number>;
  bondedCompanions: Record<string, number>;
  discoveredCardIds: string[];
}): boolean {
  const {
    materialInventory,
    constructedBuildings,
    plantedFarms,
    completedResearch,
    bondedCompanions,
    discoveredCardIds,
  } = input;

  for (const [items, levels] of [
    [buildings, constructedBuildings],
    [farmPlots, plantedFarms],
    [researchUpgrades, completedResearch],
  ] as const) {
    if (items.some((item) => canUpgradeTierItem(item, levels[item.id] ?? 0, materialInventory))) return true;
  }

  return companionTierItems.some(({ id }) =>
    canBondCompanion(id, discoveredCardIds, bondedCompanions, materialInventory),
  );
}
