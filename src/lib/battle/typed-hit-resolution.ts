import { applyHitHealth } from "./hit-facts";
import type { HitFacts } from "./hit-facts";
import type { DamageType } from "@/lib/game-data";
import { applyHitEpilogue, mergeCombatText } from "./combat-text";
import { applyDamageStatuses } from "./damage-status-riders";
import { decayArmorAfterDamage } from "./status-helpers";
import { type BattleState, type CombatTextEvent } from "./types";

export function resolveTypedEnemyHit(
  state: BattleState,
  effect: { kind: "damage"; damageType: DamageType; amount: number },
  resolvedDamage: number,
  combatTexts: CombatTextEvent[],
  eligibility = state,
): { state: BattleState; facts: HitFacts } {
  const { state: damaged, facts } = applyHitHealth(state, resolvedDamage, eligibility);
  let next = decayArmorAfterDamage(damaged, resolvedDamage, "enemy", combatTexts);
  // Buildup can trigger another hit. Resolve it before thresholds and once-only kill rewards.
  next = applyDamageStatuses(next, effect, resolvedDamage, combatTexts, facts.previousHealth);
  if (resolvedDamage > 0) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: effect.damageType, amount: resolvedDamage });
  }
  // Shared closer: thresholds then kill payouts (same as other hit paths).
  next = applyHitEpilogue(next, facts.previousHealth, facts.enemyWasAlive, combatTexts);
  return { facts, state: next };
}
