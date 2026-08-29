export const SHOP_CONFIG = {
  shop: { price: 30 },
  alchemist: { price: 30 },
  equipment: { price: 40 },
  trinket: { price: 100 },
} as const;

export const SHOP_CARD_PRICE = SHOP_CONFIG.shop.price;
export const SHOP_REMOVE_PRICE = 40;
export const SHOP_REFRESH_PRICE = 20;

export const ALCHEMIST_POTION_PRICE = SHOP_CONFIG.alchemist.price;
export const ALCHEMIST_REFRESH_PRICE = 20;
export const ALCHEMIST_MIX_PRICE = 40;

export const TRINKET_SHOP_TRINKET_PRICE = SHOP_CONFIG.trinket.price;
export const TRINKET_SHOP_OFFERED = 3;
export const TRINKET_SHOP_REFRESHES = 1;

export const EQUIPMENT_SHOP_BASIC_PRICE = SHOP_CONFIG.equipment.price;
export const EQUIPMENT_SHOP_ASTRAL_PRICE = 80;
export const EQUIPMENT_SHOP_UNIQUE_PRICE = 100;
export const EQUIPMENT_SHOP_OFFERED = 3;
export const EQUIPMENT_SHOP_REFRESHES = 1;
export const EQUIPMENT_SHOP_DROP_RATES = {
  unique: 0.05,
  astral: 0.35,
  basic: 0.6,
} as const;

export const DROP_RATES_BOSS = {
  unique: 0.3,
} as const;

export const DROP_RATES_NORMAL = {
  unique: 0.05,
  astral: 0.08,
} as const;

export const GEAR_REWARD_PERMANENT_TRINKET_CHANCE = {
  normal: 1 / 3,
  boss: 0.3,
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
export const DESTINATION_POST_OFFER_DAMPEN = 0;

export const CORRUPTION_TRANSFORM_CHANCE = 0.2;
export const CORRUPTION_DELTA_CHANCE = 0.2;
export const CORRUPTION_MUTATION_DELTA = 1;
export const CORRUPTION_MIN_VALUE = 0;
export const CORRUPTION_TEXT_PATTERNS = {
  authoredNumber: /\d+/g,
  leadingNumber: /^\d+/,
} as const;

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
export const BOSS_HEALTH_MULTIPLIER = 1.4;
export const GEAR_REWARD_RARITY_CHANCE = 0.5;

export const GEAR_ASTRAL_GUARANTEE_BONUS = 1;
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
} as const;
