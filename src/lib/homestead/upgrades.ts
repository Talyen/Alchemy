import type { MaterialInventory } from "./types";
import type { TieredItem } from "./tiers";
import { canAfford, subtractInventory } from "./inventory";

export function tryUpgradeTierItem(
  item: TieredItem<string, { cost: MaterialInventory }> | undefined,
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
