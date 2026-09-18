import type { DamageType } from "@/lib/game-data";
import { applyHitEpilogue, mergeCombatText } from "./combat-text";
import { applyDamageStatuses } from "./damage-status-riders";
import { decayArmorAfterDamage } from "./status-helpers";
import { damageEnemyHealth, type BattleState, type CombatTextEvent, type EnemyHitHealth } from "./types";

export function resolveTypedEnemyHit(
  state: BattleState,
  effect: { kind: "damage"; damageType: DamageType; amount: number },
  resolvedDamage: number,
  combatTexts: CombatTextEvent[],
): EnemyHitHealth {
  const hit = damageEnemyHealth(state, resolvedDamage);
  let next = decayArmorAfterDamage(hit.state, resolvedDamage, "enemy", combatTexts);
  // Buildup can trigger another hit. Resolve it before thresholds and once-only kill rewards.
  next = applyDamageStatuses(next, effect, resolvedDamage, combatTexts, hit.previousHealth);
  if (resolvedDamage > 0) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: effect.damageType, amount: resolvedDamage });
  }
  // Shared closer: thresholds then kill payouts (same as other hit paths).
  next = applyHitEpilogue(next, hit.previousHealth, hit.enemyWasAlive, combatTexts);
  return { ...hit, state: next };
}
