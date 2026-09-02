export const HOMESTEAD_LOOT_MULTIPLIERS = {
  normal: 1,
  elite: 1.3,
  boss: 3,
} as const;

export const HOMESTEAD_LOOT_CONFIG = {
  enemyTypeMultipliers: HOMESTEAD_LOOT_MULTIPLIERS,
} as const;
