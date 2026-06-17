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
  | "runesmiths-workshop"
  | "companion-sanctuary"
  | "wishing-well";

export type FarmId = "wheat-field" | "herb-garden" | "chicken-coop" | "pasture" | "orchard" | "crystal-garden";

export type ResearchId =
  | "carpentry"
  | "masonry"
  | "crop-rotation"
  | "animal-husbandry"
  | "fortified-walls"
  | "metallurgy";

type HomesteadUpgradeTier = {
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
  /** Hidden from UI until content is implemented; save data is preserved. */
  hidden?: boolean;
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
  potionPotency: number;
  herbFindBonus: number;
  endRunFoodPerRoom: number;
  endRunHerbsPerRoom: number;
  endRunCrystalPerRoom: number;
  forgeToBurn: boolean;
  flatBurnDamage: number;
  flatArrowDamage: number;
  flatFreezeDamage: number;
  flatNatureDamage: number;
  wishCrystalGold: number;
  startMana: number;
  consumeHealMultiplier: number;
  potionMixPotency: number;
  gearAstralChanceBonus: number;
  burnDamageReduction: number;
  freezeDamageReduction: number;
  natureDamageReduction: number;
};
