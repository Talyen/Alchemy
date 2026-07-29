/**
 * Status effect barrel: trait multipliers and re-exports from split status modules.
 * Depended on by: ./effect-handlers, ./damage, ./status-ticks, ./damage-riders.
 */
export { applyDamageStatuses, applyPoisonTalentRiders, tryTriggerEnemyFreeze } from "./status-damage-riders";
export { resolveStunTrigger } from "./status-stun-resolve";
export { applyPlayerDamageStatuses, applyPlayerStatusEffect, removeHarmfulPlayerStatuses } from "./status-player";
export { getEnemyDamageMultiplier } from "./status-helpers";
