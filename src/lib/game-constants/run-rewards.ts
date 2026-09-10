export const SHOP_CARD_PRICE = 30;
export const SHOP_REMOVE_PRICE = 40;
export const SHOP_REFRESH_PRICE = 20;

export const ALCHEMIST_POTION_PRICE = 30;
export const ALCHEMIST_REFRESH_PRICE = 20;
export const ALCHEMIST_MIX_PRICE = 40;

export const TRINKET_SHOP_TRINKET_PRICE = 100;
export const TRINKET_SHOP_OFFERED = 3;
export const TRINKET_SHOP_REFRESHES = 1;

export const EQUIPMENT_SHOP_BASIC_PRICE = 40;
export const EQUIPMENT_SHOP_ASTRAL_PRICE = 80;
export const EQUIPMENT_SHOP_UNIQUE_PRICE = 100;
export const EQUIPMENT_SHOP_OFFERED = 3;
export const EQUIPMENT_SHOP_REFRESHES = 1;
export const LOOT_SOURCE_WEIGHTS = {
  normal: { card: 0.55, basic: 0.17, boon: 0.1, astral: 0.07, trinket: 0.06, unique: 0.05 },
  elite: { card: 0.3, basic: 0.25, boon: 0.18, astral: 0.1, trinket: 0.09, unique: 0.08 },
  boss: { card: 0, basic: 0, boon: 0, astral: 0.49, trinket: 0.3, unique: 0.21 },
  wildwood: {
    card: 1 / 3,
    basic: (2 / 9) * 0.87,
    boon: 1 / 3,
    astral: (2 / 9) * 0.08,
    trinket: 1 / 9,
    unique: (2 / 9) * 0.05,
  },
  equipment: { card: 0, basic: 0.7, boon: 0, astral: 0.25, trinket: 0, unique: 0.05 },
  mystery: { card: 0, basic: 0.5, boon: 0, astral: 0.5, trinket: 0, unique: 0 },
  trinket: { card: 0, basic: 0, boon: 0, astral: 0, trinket: 1, unique: 0 },
  masterwork: { card: 0, basic: 0, boon: 0, astral: 1, trinket: 0, unique: 0 },
} as const;

export const LOOT_DEPTH_CURVES = {
  astral: [
    { depth: 4, weight: 0.2 },
    { depth: 8, weight: 0.6 },
    { depth: 16, weight: 1 },
  ],
  trinket: [
    { depth: 8, weight: 0.35 },
    { depth: 16, weight: 1 },
  ],
  unique: [
    { depth: 12, weight: 0.2 },
    { depth: 24, weight: 1 },
  ],
} as const;

export const LOOT_ACCOUNT_MULTIPLIERS = {
  none: 1,
  "difficulty-1": 1.1,
  "difficulty-2": 1.2,
  "difficulty-3": 1.3,
} as const;

export const DRAFT_ROUNDS = 6;
export const DRAFT_CHOICES = 3;

export const GOLD_REWARD_MIN = 10;
export const GOLD_REWARD_MAX = 30;
export const ELITE_GOLD_BONUS_FRACTION = 0.3;
export const BOSS_GOLD_BONUS_FRACTION = 0.5;
export const REWARD_CARD_CHOICES = 3;
export const REWARD_RANDOM_CHANCE = 0.5;
export const DESTINATION_CHOICES = 3;
export const DEFAULT_DESTINATION_WEIGHT = 10;
export const LAST_OFFERED_DESTINATION_WEIGHT = 3;
export const DESTINATION_PITY_WEIGHT_PER_ROUND = 3;
export const DESTINATION_PITY_WEIGHT_CAP = 30;

export const CORRUPTION_DESTINATION_WEIGHT = DEFAULT_DESTINATION_WEIGHT;
export const DESTINATIONS_PER_ACT = 8;
export const ACTS_PER_RUN = 3;
export const DEFAULT_CAMPAIGN_DIFFICULTY_ID = "difficulty-1";
export const SHOP_MIN_GOLD = 40;
export const CAMPFIRE_HEALTH_THRESHOLD = 0.8;
export const ELITE_HEALTH_THRESHOLD = 0.5;
export const SHOP_CARDS_OFFERED = 3;
export const SHOP_REFRESHES = 1;
export const ALCHEMIST_POTIONS_OFFERED = 3;
export const ALCHEMIST_REFRESHES = 1;
export { BOSS_HEALTH_MULTIPLIER } from "./combat-rules";

export const GEAR_AFFIX_COUNT = {
  basic: { min: 1, max: 2 },
  astral: { min: 3, max: 4 },
  unique: { min: 4, max: 4 },
} as const;

export const GEAR_AFFIX_COUNT_MIN_WEIGHT = 0.8;
export const MYSTERY_CARD_CHOICES = 3;
export const MIXED_POTION_CARD_ID = "mixed-potion";
export const POTION_CARD_ID_SUFFIX = "-potion";
export const MIXED_POTION_TITLE = "Mixed Potion";
export const MIXED_POTION_COST = 1;
export const CONSUME_DESCRIPTION_LINE = "Consume";

export const LABYRINTH_REWARD_CONFIG = {
  generousGoldBonusFraction: 0.5,
  scavengerMaterialMultiplier: 2,
  companionCardChoices: 3,
  wealthyGoldBonus: 12,
  herbalistHerbBonus: 3,
  wellProvisionedHealFraction: 0.15,
} as const;

export const REWARD_SELECTION_CONFIG = {
  newCardScoreBonus: 2,
  affinityPoolMultiplier: 2,
  companionlessScoreBonus: 2,
  companionlessRandomWeight: 2,
} as const;
