import type { TalentEffectManifest } from "@/lib/game-data";

export type MaterialId = "wood" | "iron" | "herbs" | "food" | "gems";

export const MATERIAL_IDS: [MaterialId, ...MaterialId[]] = ["wood", "iron", "herbs", "food", "gems"];

export const materialLabels: Record<MaterialId, string> = {
  wood: "Wood",
  iron: "Iron",
  herbs: "Herbs",
  food: "Food",
  gems: "Gems",
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
  | "leyline-energy"
  | "detect-magic"
  | "botanical-distillation"
  | "culinary-arts"
  | "wool-tailoring"
  | "agility-training";

export interface HomesteadUpgradeTier {
  cost: MaterialInventory;
  effects?: Partial<HomesteadEffectManifest>;
  benefitDescription: string;
  nonCombatBenefitDescription?: string;
}

export interface HomesteadUpgradeItem<TId extends string = string> {
  id: TId;
  title: string;
  tiers: HomesteadUpgradeTier[];
}

export type HomesteadBuilding = HomesteadUpgradeItem<BuildingId>;
export type HomesteadFarm = HomesteadUpgradeItem<FarmId>;
export type HomesteadResearch = HomesteadUpgradeItem<ResearchId>;

type NumericTalentKey = {
  [K in keyof TalentEffectManifest]: TalentEffectManifest[K] extends number ? K : never;
}[keyof TalentEffectManifest];

type BooleanTalentKey = {
  [K in keyof TalentEffectManifest]: TalentEffectManifest[K] extends boolean ? K : never;
}[keyof TalentEffectManifest];

type RecordTalentKey = {
  [K in keyof TalentEffectManifest]: TalentEffectManifest[K] extends Record<string, unknown> ? K : never;
}[keyof TalentEffectManifest];

export const HOMESTEAD_BATTLE_NUMERIC_KEYS = [
  "flatPhysicalDamage",
  "companionDamage",

  "potionPotency",
  "flatBurnDamage",
  "flatArrowDamage",
  "flatFreezeDamage",
  "flatNatureDamage",
  "wishCrystalGold",
  "startMana",
  "consumeHealMultiplier",
  "potionMixPotency",
  "burnDamageReduction",
  "freezeDamageReduction",
  "natureDamageReduction",
  "poisonDamageReduction",
  "runMaxHealthBonus",
  "runMaxManaBonus",
] as const satisfies readonly NumericTalentKey[];

export const HOMESTEAD_BATTLE_BOOLEAN_KEYS = ["forgeToBurn"] as const satisfies readonly BooleanTalentKey[];

export const HOMESTEAD_BATTLE_RECORD_KEYS = [
  "companionBondLevels",
  "cardHealBonus",
] as const satisfies readonly RecordTalentKey[];

type HomesteadBattleKey =
  | (typeof HOMESTEAD_BATTLE_NUMERIC_KEYS)[number]
  | (typeof HOMESTEAD_BATTLE_BOOLEAN_KEYS)[number]
  | (typeof HOMESTEAD_BATTLE_RECORD_KEYS)[number];

type HomesteadBattleEffects = Pick<TalentEffectManifest, HomesteadBattleKey>;

interface HomesteadMetaEffects {
  herbFindBonus: number;
  endRunFoodPerRoom: number;
  endRunHerbsPerRoom: number;
  endRunGemsPerRoom: number;
  gearAstralChanceBonus: number;
}

export type HomesteadEffectManifest = HomesteadBattleEffects & HomesteadMetaEffects;
