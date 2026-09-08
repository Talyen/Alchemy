export const CORRUPTION_TRANSFORM_CHANCE = 0.1;
export const CORRUPTION_MIN_VALUE = 0;
export const CORRUPTION_TEXT_PATTERNS = {
  authoredNumber: /\d+/g,
  leadingNumber: /^\d+/,
} as const;

export const CORRUPTION_OUTCOME_WEIGHTS = {
  strengthen: 35,
  weaken: 12,
  secondary: 22,
  bargain: 10,
  convert: 5,
  draw: 1,
  mana: 1,
  leech: 1,
  consume: 2,
  reusable: 1,
} as const;

export const CORRUPTION_STRENGTHEN_RATIO = 0.5;
export const CORRUPTION_WEAKEN_RATIO = 0.25;
export const CORRUPTION_CONSUME_MULTIPLIER = 3;
export const CORRUPTION_HEALTH_PRICE = 2;
export const CORRUPTION_SECONDARY_AMOUNT = 2;
export const CORRUPTION_SECONDARY_STATUS_DAMAGE = 1;
export const CORRUPTION_JACKPOT_AMOUNT = 1;
export const CORRUPTION_MAX_EFFECT_LINES = 4;
export const CORRUPTION_DAMAGE_BASELINES = {
  physical: 6,
  holy: 4,
  nature: 4,
  burn: 2,
  poison: 2,
  bleed: 3,
  freeze: 3,
  stun: 3,
} as const;
