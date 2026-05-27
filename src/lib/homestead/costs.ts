// Shared homestead upgrade cost curves (single- and dual-material tiers).
import type { MaterialId, MaterialInventory } from "./types";

const HOMESTEAD_SINGLE_TIER_COSTS = [20, 30, 40] as const;
const HOMESTEAD_DUAL_TIER_COSTS = [10, 15, 20] as const;

export function materialCost(partial: Partial<MaterialInventory>): MaterialInventory {
  return { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0, ...partial };
}

export function singleMaterialCosts(material: MaterialId): MaterialInventory[] {
  return HOMESTEAD_SINGLE_TIER_COSTS.map((amount) => materialCost({ [material]: amount }));
}

export function dualMaterialCosts(a: MaterialId, b: MaterialId): MaterialInventory[] {
  return HOMESTEAD_DUAL_TIER_COSTS.map((amount) => materialCost({ [a]: amount, [b]: amount }));
}
