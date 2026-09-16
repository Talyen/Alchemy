export const SALVAGE_DICE_HIGH_CHANCE_FRACTION = 0.5;
export const SALVAGE_BASIC_SPRIG_CHANCE_FRACTION = 0.5;
export const SALVAGE_BASIC_VOIDSTONE_CHANCE_FRACTION = 0.25;
export const SALVAGE_ADVANCED_SEAL_CHANCE_FRACTION = 0.35;
export const SALVAGE_ADVANCED_MAW_CHANCE_FRACTION = 0.35;
export const SALVAGE_ADVANCED_WHETSTONE_CHANCE_FRACTION = 0.35;
export const UNIQUE_GEAR_COMBAT = {
  echoDamageMultiplier: 0.5,
  viperDamageMultiplier: 0.5,
  retainedStunMultiplier: 0.25,
  wrenflightDodgeChancePercent: 10,
  winterBlockPerMana: 3,
  returnedCardDiscount: 1,
} as const;

// Affix-count tuning lives with the rest of gear tuning (not run-rewards):
// generation, crafting, and validation all read these together with the
// salvage chances above.
export const GEAR_AFFIX_COUNT = {
  basic: { min: 1, max: 2 },
  astral: { min: 3, max: 4 },
  unique: { min: 4, max: 4 },
} as const;

export const GEAR_AFFIX_COUNT_MIN_WEIGHT = 0.8;
