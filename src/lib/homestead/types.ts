// Core types for the Homestead persistent progression system.
// Materials, building/farm/research IDs, and effect manifests.

export type MaterialId = "wood" | "iron" | "herbs" | "food" | "crystal";

export const MATERIAL_IDS: MaterialId[] = ["wood", "iron", "herbs", "food", "crystal"];

export const materialLabels: Record<MaterialId, string> = {
  wood: "Wood",
  iron: "Iron",
  herbs: "Herbs",
  food: "Food",
  crystal: "Crystal",
};

export const materialIcons: Record<MaterialId, string> = {
  wood: "\u{1FAB5}",
  iron: "\u{2692}",
  herbs: "\u{1F33F}",
  food: "\u{1F36E}",
  crystal: "\u{1F48E}",
};

export type MaterialInventory = Record<MaterialId, number>;

export function emptyInventory(): MaterialInventory {
  return { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 };
}

export function addInventory(a: MaterialInventory, b: MaterialInventory): MaterialInventory {
  const result = { ...a };
  for (const mat of MATERIAL_IDS) {
    result[mat] = (result[mat] ?? 0) + (b[mat] ?? 0);
  }
  return result;
}

export function canAfford(inventory: MaterialInventory, cost: MaterialInventory): boolean {
  return MATERIAL_IDS.every((mat) => (inventory[mat] ?? 0) >= (cost[mat] ?? 0));
}

export function subtractInventory(inventory: MaterialInventory, cost: MaterialInventory): MaterialInventory {
  const result = { ...inventory };
  for (const mat of MATERIAL_IDS) {
    result[mat] = Math.max(0, (result[mat] ?? 0) - (cost[mat] ?? 0));
  }
  return result;
}

export type BuildingId = "blacksmiths-forge" | "hunters-lodge" | "alchemy-lab" | "placeholder-1" | "placeholder-2" | "placeholder-3";

export type FarmId = "wheat-field" | "herb-garden" | "chicken-coop" | "pasture" | "orchard" | "crystal-garden";

export type ResearchId = "carpentry" | "masonry" | "crop-rotation" | "animal-husbandry" | "fortified-walls" | "metallurgy";

export type HomesteadBuilding = {
  id: BuildingId;
  title: string;
  description: string;
  cost: MaterialInventory;
  benefitDescription: string;
  nonCombatBenefitDescription?: string;
  buttonLabel: string;
};

export type HomesteadFarm = {
  id: FarmId;
  title: string;
  description: string;
  cost: MaterialInventory;
  yield: MaterialInventory;
  benefitDescription?: string;
  nonCombatBenefitDescription?: string;
  buttonLabel: string;
};

export type HomesteadResearch = {
  id: ResearchId;
  title: string;
  description: string;
  cost: MaterialInventory;
  benefitDescription: string;
  buttonLabel: string;
};

// Pre-computed bonuses that Homestead provides to runs. Battle-level effects
// are merged into TalentEffectManifest; run-level effects applied at character select.
export type HomesteadEffectManifest = {
  flatPhysicalDamage: number;
  companionDamage: number;
  potionHealMultiplier: number;
  potionManaBonus: number;
  potionDiscount: number;
  startGold: number;
  startBlock: number;
  campfireHealBonus: number;
  physicalCritChance: number;
  startMaxHealthBonus: number;
  buildingCostReduction: number;
  farmYieldMultiplier: number;
  forgeToBurn: number;
};

export const defaultHomesteadEffects: HomesteadEffectManifest = {
  flatPhysicalDamage: 0,
  companionDamage: 0,
  potionHealMultiplier: 0,
  potionManaBonus: 0,
  potionDiscount: 0,
  startGold: 0,
  startBlock: 0,
  campfireHealBonus: 0,
  physicalCritChance: 0,
  startMaxHealthBonus: 0,
  buildingCostReduction: 0,
  farmYieldMultiplier: 0,
  forgeToBurn: 0,
};
