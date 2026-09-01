import type { TalentEffectManifest } from "@/lib/game-data";

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
  | "leyline-energy"
  | "detect-magic"
  | "botanical-distillation"
  | "culinary-arts"
  | "wool-tailoring"
  | "agility-training";

interface HomesteadUpgradeTier {
  cost: MaterialInventory;
  effects?: Partial<HomesteadEffectManifest>;
  benefitDescription: string;
  nonCombatBenefitDescription?: string;
}

export interface HomesteadBuilding {
  id: BuildingId;
  title: string;
  description: string;
  tiers: HomesteadUpgradeTier[];
  buttonLabel: string;
}

export interface HomesteadFarm {
  id: FarmId;
  title: string;
  description: string;
  tiers: HomesteadUpgradeTier[];
  buttonLabel: string;
}

export interface HomesteadResearch {
  id: ResearchId;
  title: string;
  description: string;
  tiers: HomesteadUpgradeTier[];
  buttonLabel: string;
}

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
  endRunCrystalPerRoom: number;
  gearAstralChanceBonus: number;
}

export type HomesteadEffectManifest = HomesteadBattleEffects & HomesteadMetaEffects;
