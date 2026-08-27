import { LEECH_HEAL_FRACTION } from "../game-constants";

/** Leech keyword: heal for half the triggering damage (rounded). */
export function computeLeechHeal(damageDealt: number): number {
  if (damageDealt <= 0) return 0;
  return Math.round(damageDealt * LEECH_HEAL_FRACTION);
}
