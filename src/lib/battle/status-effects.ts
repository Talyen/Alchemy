/**
 * Status effect barrel: trait multipliers and re-exports from split status modules.
 * Depended on by: ./apply-effects, ./damage, ./status-ticks, ./damage-riders.
 */
import type { BattleState } from "./types";
import { TRAIT_DAMAGE_RULES, TRAIT_DAMAGE_WEAKNESS } from "../game-constants";

export { applyDamageStatuses, applyPoisonTalentRiders } from "./status-damage-riders";
export { resolveStunTrigger } from "./status-stun-resolve";
export { applyPlayerDamageStatuses, applyPlayerStatusEffect, removeHarmfulPlayerStatuses } from "./status-player";

/** Trait weakness/resistance — first matching trait wins. */
export function getEnemyDamageMultiplier(
  state: Pick<BattleState, "currentEnemy" | "enemyStunSkipTurns" | "enemyFreezeSkipTurns" | "talentEffects">,
  damageType: string,
): number {
  const traitIds = state.currentEnemy.traits.map((t) => t.id);
  for (const rule of TRAIT_DAMAGE_RULES) {
    if (traitIds.includes(rule.traitId) && damageType === rule.damageType) return rule.multiplier;
  }
  let multiplier = 1;
  if (state.enemyStunSkipTurns > 0 && state.talentEffects.stunDoubleDamage) multiplier *= TRAIT_DAMAGE_WEAKNESS;
  if (state.enemyFreezeSkipTurns > 0 && state.talentEffects.freezeDoubleDamage) multiplier *= TRAIT_DAMAGE_WEAKNESS;
  return multiplier;
}
