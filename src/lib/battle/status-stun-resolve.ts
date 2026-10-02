import { applyThunderstoneLeech } from "./damage-rider-leech";
import { resolveStunTriggerCore } from "./status-stun-core";
import type { BattleState, CombatTextEvent } from "./types";

// Bind the shallow Leech recipe here; the lower Stun entry receives it as a
// callback so Leech can trigger Stun without importing its own orchestrator.
export function resolveStunTrigger(
  state: BattleState,
  combatTexts?: CombatTextEvent[],
  preHitHealth = state.enemyHealth,
  fromHolyDamage = false,
): BattleState {
  return resolveStunTriggerCore(state, combatTexts, preHitHealth, fromHolyDamage, applyThunderstoneLeech);
}
