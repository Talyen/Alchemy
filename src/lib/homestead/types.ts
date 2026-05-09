// Core types for the Homestead persistent progression system.
// Materials, building/farm/research IDs, and effect manifests.

export type MaterialId = "wood" | "stone" | "iron" | "herbs" | "food" | "leather" | "crystal";

export const MATERIAL_IDS: MaterialId[] = ["wood", "stone", "iron", "herbs", "food", "leather", "crystal"];

export const materialLabels: Record<MaterialId, string> = {
  wood: "Wood",
  stone: "Stone",
  iron: "Iron",
  herbs: "Herbs",
  food: "Food",
  leather: "Leather",
  crystal: "Crystal",
};

export const materialIcons: Record<MaterialId, string> = {
  wood: "\u{1FAB5}", // wooden placeholder
  stone: "\u{1FAA8}", // rock placeholder
  iron: "\u{2692}", // hammer & pick
  herbs: "\u{1F33F}", // herb
  food: "\u{1F36E}", // food
  leather: "\u{1F9FA}", // leather
  crystal: "\u{1F48E}", // gem
};

export type MaterialInventory = Record<MaterialId, number>;

export function emptyInventory(): MaterialInventory {
  return { wood: 0, stone: 0, iron: 0, herbs: 0, food: 0, leather: 0, crystal: 0 };
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

export type BuildingId = "workshop" | "storehouse" | "stone-walls" | "herb-shed" | "watchtower" | "smithy";

export type FarmId = "wheat-field" | "herb-garden" | "chicken-coop" | "sheep-pasture" | "orchard" | "crystal-garden";

export type ResearchId = "carpentry" | "masonry" | "crop-rotation" | "animal-husbandry" | "fortified-walls" | "metallurgy";

export type HomesteadBuilding = {
  id: BuildingId;
  title: string;
  description: string;
  cost: MaterialInventory;
  benefitDescription: string;
  buttonLabel: string;
};

export type HomesteadFarm = {
  id: FarmId;
  title: string;
  description: string;
  cost: MaterialInventory;
  yield: MaterialInventory;
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
  startGold: number;
  startBlock: number;
  campfireHealBonus: number;
  physicalCritChance: number;
  startMaxHealthBonus: number;
  buildingCostReduction: number;
  farmYieldMultiplier: number;
};

export const defaultHomesteadEffects: HomesteadEffectManifest = {
  flatPhysicalDamage: 0,
  startGold: 0,
  startBlock: 0,
  campfireHealBonus: 0,
  physicalCritChance: 0,
  startMaxHealthBonus: 0,
  buildingCostReduction: 0,
  farmYieldMultiplier: 0,
};
