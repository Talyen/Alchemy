import type { MaterialId, MaterialInventory } from "./types";
import { emptyInventory } from "./inventory";

const HOMESTEAD_SINGLE_TIER_COSTS = [20, 30, 40] as const;
const HOMESTEAD_DUAL_TIER_COSTS = [10, 15, 20] as const;

export function materialCost(partial: Partial<MaterialInventory>): MaterialInventory {
  return { ...emptyInventory(), ...partial };
}

export function singleMaterialCosts(material: MaterialId): MaterialInventory[] {
  return HOMESTEAD_SINGLE_TIER_COSTS.map((amount) => materialCost({ [material]: amount }));
}

export function dualMaterialCosts(a: MaterialId, b: MaterialId): MaterialInventory[] {
  return HOMESTEAD_DUAL_TIER_COSTS.map((amount) => materialCost({ [a]: amount, [b]: amount }));
}
