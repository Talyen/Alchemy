import { CAMPFIRE_HEAL_FRACTION } from "./game-constants";

export function getCampfireHealFraction(campfireHealBonus = 0): number {
  return CAMPFIRE_HEAL_FRACTION + campfireHealBonus;
}

export function getCampfireRestHealth(
  currentHealth: number,
  maxHealth: number,
  healFraction: number = CAMPFIRE_HEAL_FRACTION,
  healingBonus = 0,
): number {
  return Math.min(maxHealth, currentHealth + Math.round(maxHealth * healFraction) + healingBonus);
}
