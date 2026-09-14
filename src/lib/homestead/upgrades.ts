import type { MaterialInventory } from "./types";
import type { TieredItem } from "./tiers";
import { canAfford, subtractInventory } from "./inventory";

export function getNextTierCost(
  item: TieredItem<string, { cost: MaterialInventory }> | undefined,
  currentLevel: number,
): MaterialInventory | null {
  if (!item || currentLevel < 0 || currentLevel >= item.tiers.length) return null;
  return item.tiers[currentLevel]?.cost ?? null;
}

export function canUpgradeTierItem(
  item: TieredItem<string, { cost: MaterialInventory }> | undefined,
  currentLevel: number,
  inventory: MaterialInventory,
): boolean {
  const cost = getNextTierCost(item, currentLevel);
  return cost !== null && canAfford(inventory, cost);
}

export function tryUpgradeTierItem(
  item: TieredItem<string, { cost: MaterialInventory }> | undefined,
  currentLevel: number,
  inventory: MaterialInventory,
): { ok: boolean; inventory: MaterialInventory; nextLevel: number } {
  const cost = getNextTierCost(item, currentLevel);
  if (!cost || !canAfford(inventory, cost)) {
    return { ok: false, inventory, nextLevel: currentLevel };
  }
  return {
    ok: true,
    inventory: subtractInventory(inventory, cost),
    nextLevel: currentLevel + 1,
  };
}
