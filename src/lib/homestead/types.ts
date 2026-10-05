import type { TalentEffectManifest } from "@/lib/game-data";

export const MATERIAL_IDS = ["wood", "stone", "iron", "food", "herbs", "hide", "gems"] as const;
export type MaterialId = (typeof MATERIAL_IDS)[number];

export const materialLabels: Record<MaterialId, string> = {
  wood: "Wood",
  stone: "Stone",
  iron: "Iron",
  food: "Food",
  herbs: "Herbs",
  hide: "Hide",
  gems: "Gems",
};

export type MaterialInventory = Record<MaterialId, number>;

export type BuildingId =
  | "blacksmiths-forge"
  | "hunters-lodge"
  | "alchemy-lab"
  | "runesmiths-workshop"
  | "companion-sanctuary"
  | "wishing-well"
  | "transmutation-crucible"
  | "mycology-cellar"
  | "sparring-grounds"
  | "archery-range"
  | "library";

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

type RecordTalentKey = {
  [K in keyof TalentEffectManifest]: TalentEffectManifest[K] extends Record<string, unknown> ? K : never;
}[keyof TalentEffectManifest];

export const HOMESTEAD_BATTLE_NUMERIC_KEYS = [
  "flatPhysicalDamage",
  "flatHolyDamage",
  "physicalDamageReduction",
  "homesteadCriticalDamage",
  "homesteadHealing",
  "homesteadLeechHealing",
  "homesteadPotionBonus",
  "homesteadFreeManaChance",
  "homesteadForgeBurnPercent",
  "dodgeChance",
  "wishExtraChoiceChance",
  "companionDamage",
  "flatBurnDamage",
  "flatArrowDamage",
  "flatFreezeDamage",
  "flatNatureDamage",
  "startBlock",
  "burnDamageReduction",
  "freezeDamageReduction",
  "poisonDamageReduction",
  "runMaxHealthBonus",
] as const satisfies readonly NumericTalentKey[];

export const HOMESTEAD_BATTLE_BOOLEAN_KEYS = [] as const;

export const HOMESTEAD_BATTLE_RECORD_KEYS = [
  "companionBondLevels",
  "cardHealBonus",
] as const satisfies readonly RecordTalentKey[];

type HomesteadBattleKey =
  | (typeof HOMESTEAD_BATTLE_NUMERIC_KEYS)[number]
  | (typeof HOMESTEAD_BATTLE_RECORD_KEYS)[number];

type HomesteadBattleEffects = Pick<TalentEffectManifest, HomesteadBattleKey>;

interface HomesteadMetaEffects {
  endRunStonePerRoom: number;
  endRunGoldPerRoom: number;
  endRunWishPerRoom: number;
  removeCardDiscount: number;
  mixPotionDiscount: number;

  herbFindBonus: number;
  endRunFoodPerRoom: number;
  endRunHerbsPerRoom: number;
  endRunHidePerRoom: number;
  endRunGemsPerRoom: number;
  endRunIronPerRoom: number;
  endRunWoodPerRoom: number;
  gearAstralChanceBonus: number;
}

export type HomesteadEffectManifest = HomesteadBattleEffects & HomesteadMetaEffects;
