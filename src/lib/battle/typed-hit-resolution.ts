import type { DamageType } from "@/lib/game-data";
import { mergeCombatText, payKillPayouts } from "./combat-text";
import { applyDamageStatuses } from "./damage-status-riders";
import { processEncounterTraitHealthThreshold } from "./encounter-trait-health-threshold";
import { decayArmorAfterDamage } from "./status-helpers";
import { damageEnemyHealth, type BattleState, type CombatTextEvent } from "./types";

export function resolveTypedEnemyHit(
  state: BattleState,
  effect: { kind: "damage"; damageType: DamageType; amount: number },
  resolvedDamage: number,
  combatTexts: CombatTextEvent[],
): { state: BattleState; previousHealth: number } {
  const hit = damageEnemyHealth(state, resolvedDamage);
  let next = decayArmorAfterDamage(hit.state, resolvedDamage, "enemy", combatTexts);
  // Buildup can trigger another hit. Resolve it before thresholds and once-only kill rewards.
  next = applyDamageStatuses(next, effect, resolvedDamage, combatTexts, hit.previousHealth);
  if (resolvedDamage > 0) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: effect.damageType, amount: resolvedDamage });
  }
  next = processEncounterTraitHealthThreshold(hit.previousHealth, next, combatTexts);
  next = payKillPayouts(next, hit.enemyWasAlive, combatTexts);
  return { state: next, previousHealth: hit.previousHealth };
}
