export const GLOBAL_CRIT_CHANCE_PERCENT = 5;

export const PLAYER_DODGE_CHANCE_PERCENT = 5;
export const MAX_PLAYER_DODGE_CHANCE_PERCENT = 75;

export const ENEMY_DODGE_CHANCE_PERCENT = 5;
export const CRIT_MULTIPLIER = 2;
export const BLEED_STATUS_MULTIPLIER = 1;
export const STUN_THRESHOLD_FRACTION = 0.5;
export const FREEZE_THRESHOLD_FRACTION = 0.5;
// Shared floor for crowd-control trigger thresholds: reduction effects can
// never push a threshold below 10% of max health, so buildup alone cannot
// trigger a skip for free.
export const MIN_CC_THRESHOLD_FRACTION = 0.1;
export const WISH_CHOICE_COUNT = 3;
export const MIN_MAX_MANA_FLOOR = 1;

export const ROOM_SCALING_INCREMENT = 0.07;
export const ELITE_HP_MULTIPLIER = 1.8;
export const BOSS_HEALTH_MULTIPLIER = 2.8;
export const STARTING_TURN = 1;
export const ENEMY_BASE_REGENERATION = 1;
export const ENEMY_BOSS_REGENERATION = 1;

export const FREE_CARD_SENTINEL = 99;

export const LOW_HEALTH_THRESHOLD_PERCENT = 30;
// Full-health gate for Longshot (archery doubled vs unwounded): triggers only
// at 100% HP, unlike the 30% "low health" gates elsewhere.
export const ARCHERY_FULL_HEALTH_THRESHOLD_PERCENT = 100;
export const ARCHERY_LOW_HEALTH_THRESHOLD_PERCENT = 20;
export const PERCENT_DENOMINATOR = 100;
export const HALF_DIVISOR = 2;

export const LEECH_HEAL_FRACTION = 0.5;

export const FIRST_EFFECT_MULTIPLIER = 2;

export const MANABURN_DAMAGE_PERCENT = 20;
export const BLACKFLETCH_EXECUTE_HEALTH_PERCENT = 30;

export const BLOCK_SCALED_DAMAGE_PERCENT = 30;
export const MIN_DAMAGE_MULTIPLIER = 0.1;
export const BURN_BLOCK_SCALED_DAMAGE_PERCENT = 10;
export const GOLD_TROVE_REWARD_MULTIPLIER = 2;

export const CARDS_PER_TURN = 4;

export const DEATHS_DOOR_GRACE_TURNS = 2;
export const MAX_HAND_SIZE = 7;
export const MAX_PLAYER_HEALTH = 30;
export const MAX_HEALTH_PER_TALENT_POINT = 1;
export const BASE_ENEMY_HEALTH = 30;
export const BASE_PLAYER_MANA = 4;
export const DEFAULT_BATTLE_ENEMY_TYPE = "normal";

export const FIGHT_PACING = {
  evenThreshold: 0.1,
  maxDelta: 0.5,
  comebackMin: 0.1,
  comebackMax: 0.2,
  scheduleThreshold: 0.03,
  gapFullScale: 0.1,
  clockMin: 0.1,
  clockMax: 0.2,
  burnFractionAtTarget: 0.5,
  backstopSpan: 4,
  clockByEnemyType: {
    normal: { targetDuration: 7.0, maxRounds: 10, damageOverrunSpan: 4 },
    elite: { targetDuration: 12.0, maxRounds: 16, damageOverrunSpan: 4 },
    boss: { targetDuration: 20.0, maxRounds: 30, damageOverrunSpan: 3 },
  },
} as const;

export const CAMPFIRE_HEAL_FRACTION = 0.3;

export const WISH_GEMS_GOLD_PERCENT = 50;
export const WISH_TRINKET_FORK_PERCENT = 50;

export const BRASS_CENSER_SPLIT_CHANCE_PERCENT = 50;
export const SEPTIC_SPLIT_CHANCE_PERCENT = 50;
export const TALENT_CONVERSION_DEFAULT_FRACTION = 0.5;
export const TALENT_CONVERSION_BLEED_FRACTION = 0.25;

export const BATTLE_CONFIG = {
  CC_IMMUNITY_DURATION: 3,
  BASE_CC_DURATION: 1,
  ARMOR_DECAY_AMOUNT: 1,
  FORGE_DECAY_AMOUNT: 1,
} as const;

export const POISON_DECAY_PERCENT = 20;
export const POISON_GAIN_AMOUNT = 1;
export const BURN_BLEED_MIRROR_CHANCE_PERCENT = 20;
export const STATUS_DECAY_THRESHOLD = 1;
export const MIN_ARMOR_AMOUNT = 0;

export const STATUS_CONFIG = {
  MIN_STACK_AMOUNT: 1,
  CC_NOTICE_STUN: "Stunned",
  CC_NOTICE_FREEZE: "Frozen",
  DODGE_NOTICE: "Dodge",
} as const;

// Separate knobs keep similarly paced rewards independently tunable.
export const REACTIVE_REWARD_CHANCES = {
  luckyFoot: 25,
  feint: 25,
  leftovers: 25,
  packWeave: 50,
  wishfulTrinket: 50,
  wishfulAffix: 50,
  riposting: 50,
  bladedance: 25,
} as const;
