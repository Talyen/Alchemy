import { CAMPFIRE_HEAL_FRACTION } from "./game-constants/combat-rules";

/** Effective campfire heal fraction including talent bonus. */
export function getCampfireHealFraction(campfireHealBonus = 0): number {
  return CAMPFIRE_HEAL_FRACTION + campfireHealBonus;
}

/** Restored Health after a campfire rest, clamped to max. */
export function getCampfireRestHealth(
  currentHealth: number,
  maxHealth: number,
  healFraction: number = CAMPFIRE_HEAL_FRACTION,
): number {
  return Math.min(maxHealth, currentHealth + Math.round(maxHealth * healFraction));
}
