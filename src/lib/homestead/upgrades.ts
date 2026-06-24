import type { MaterialInventory } from "./types";
import { canAfford, subtractInventory } from "./inventory";

interface TieredUpgradeItem {
  tiers: Array<{ cost: MaterialInventory }>;
}

export function tryUpgradeTierItem(
  item: TieredUpgradeItem | undefined,
  currentLevel: number,
  inventory: MaterialInventory,
): { ok: boolean; inventory: MaterialInventory; nextLevel: number } {
  if (!item || currentLevel >= item.tiers.length) {
    return { ok: false, inventory, nextLevel: currentLevel };
  }
  const tier = item.tiers[currentLevel]!;
  if (!canAfford(inventory, tier.cost)) {
    return { ok: false, inventory, nextLevel: currentLevel };
  }
  return {
    ok: true,
    inventory: subtractInventory(inventory, tier.cost),
    nextLevel: currentLevel + 1,
  };
}
