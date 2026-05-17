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
  wood: "icon-logs",
  iron: "icon-hammer",
  herbs: "icon-sprout",
  food: "icon-cake",
  crystal: "icon-gem",
};

export type MaterialInventory = Record<MaterialId, number>;

export type BuildingId =
  | "blacksmiths-forge"
  | "hunters-lodge"
  | "alchemy-lab"
  | "placeholder-1"
  | "placeholder-2"
  | "placeholder-3";

export type FarmId = "wheat-field" | "herb-garden" | "chicken-coop" | "pasture" | "orchard" | "crystal-garden";

export type ResearchId =
  | "carpentry"
  | "masonry"
  | "crop-rotation"
  | "animal-husbandry"
  | "fortified-walls"
  | "metallurgy";

export type HomesteadUpgradeTier = {
  cost: MaterialInventory;
  effects?: Partial<HomesteadEffectManifest>;
  benefitDescription: string;
  nonCombatBenefitDescription?: string;
};

export type HomesteadBuilding = {
  id: BuildingId;
  title: string;
  description: string;
  tiers: HomesteadUpgradeTier[];
  buttonLabel: string;
  yield?: MaterialInventory;
};

export type HomesteadFarm = {
  id: FarmId;
  title: string;
  description: string;
  tiers: HomesteadUpgradeTier[];
  yield: MaterialInventory;
  buttonLabel: string;
};

export type HomesteadResearch = {
  id: ResearchId;
  title: string;
  description: string;
  tiers: HomesteadUpgradeTier[];
  buttonLabel: string;
};

// Pre-computed bonuses that Homestead provides to runs. Battle-level effects
// are merged into TalentEffectManifest; run-level effects applied at character select.
export type HomesteadEffectManifest = {
  flatPhysicalDamage: number;
  companionDamage: number;
  companionBondLevels: Record<import("@/lib/game-data").CompanionId, number>;
  potionHealMultiplier: number;
  potionManaBonus: number;
  potionDiscount: number;
  potionPotency: number;
  herbFindBonus: number;
  startGold: number;
  startBlock: number;
  campfireHealBonus: number;
  physicalCritChance: number;
  startMaxHealthBonus: number;
  forgeToBurn: boolean;
};
