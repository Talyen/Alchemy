import { applyHitHealth } from "./hit-facts";
import type { HitFacts } from "./hit-facts";
import type { DamageType } from "@/lib/game-data";
import { applyHitEpilogue, mergeCombatText } from "./combat-text";
import { applyDamageStatuses } from "./damage-status-riders";
import { decayArmorAfterDamage } from "./status-helpers";
import { applyIronGuardReward } from "./status-player";
import { applyBleedDamageDraw } from "./bleed-reactions";
import { type BattleState, type CombatTextEvent } from "./types";

export function resolveTypedEnemyHit(
  state: BattleState,
  effect: { kind: "damage"; damageType: DamageType; amount: number },
  resolvedDamage: number,
  combatTexts: CombatTextEvent[],
  eligibility = state,
  options: {
    critical?: boolean;
    allowPoisonBleedConversion?: boolean;
    onPoisonBleedConversion?: (state: BattleState, damage: number, combatTexts: CombatTextEvent[]) => BattleState;
    onPoisonDamage?: (state: BattleState, damage: number, combatTexts: CombatTextEvent[]) => BattleState;
    allowTalentChanceProcs?: boolean;
  } = {},
): { state: BattleState; facts: HitFacts } {
  const { state: damaged, facts } = applyHitHealth(state, resolvedDamage, eligibility, options.critical ?? false);
  let next = applyIronGuardReward(damaged, effect.damageType, facts.healthDamage, combatTexts);
  if (effect.damageType === "bleed") next = applyBleedDamageDraw(next, facts.healthDamage);
  next = decayArmorAfterDamage(next, resolvedDamage, "enemy", combatTexts);
  // Buildup can trigger another hit. Resolve it before thresholds and once-only kill rewards.
  next = applyDamageStatuses(next, effect, resolvedDamage, combatTexts, facts.previousHealth, {
    ...options,
    allowTalentChanceProcs: false,
  });
  if (effect.damageType === "poison" && options.allowTalentChanceProcs !== false && options.onPoisonDamage) {
    next = options.onPoisonDamage(next, resolvedDamage, combatTexts);
  }
  if (resolvedDamage > 0) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: effect.damageType, amount: resolvedDamage });
  }
  // Shared closer: thresholds then kill payouts (same as other hit paths).
  next = applyHitEpilogue(next, facts.previousHealth, facts.enemyWasAlive, combatTexts);
  return { facts, state: next };
}
