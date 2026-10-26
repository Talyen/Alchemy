import type { DamageType } from "@/lib/game-data";
import { applyHitEpilogue } from "./player-rewards";
import { applyDamageStatuses } from "./damage-status-riders";
import { decayArmorAfterDamage } from "./status-helpers";
import { applyIronGuardReward } from "./status-player";
import {
  applyBleedDamageDraw,
  applyElementalDamageManaRestore,
  applyHitHealth,
  reportEnemyHitDamage,
  type HitFacts,
} from "./player-hit-core";
import { type BattleState, type CombatTextEvent } from "./types";
import { isPlayerDefeated } from "./battle-outcome";

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
    eligibility?: BattleState;
  } = {},
): { state: BattleState; facts: HitFacts } {
  const { state: damaged, facts } = applyHitHealth(state, resolvedDamage, eligibility, options.critical ?? false);
  let next = applyIronGuardReward(damaged, effect.damageType, facts.healthDamage, combatTexts);
  if (effect.damageType === "bleed") next = applyBleedDamageDraw(next, facts.healthDamage, combatTexts);
  if (isPlayerDefeated(next)) {
    next = decayArmorAfterDamage(next, resolvedDamage, "enemy", combatTexts);
    reportEnemyHitDamage(facts, effect.damageType, combatTexts);
    return { facts, state: next };
  }
  next = decayArmorAfterDamage(next, resolvedDamage, "enemy", combatTexts);
  // Buildup can trigger another hit. Resolve it before thresholds and once-only kill rewards.
  next = applyDamageStatuses(next, effect, resolvedDamage, combatTexts, facts.previousHealth, {
    ...options,
    eligibility: options.eligibility ?? eligibility,
  });
  if (effect.damageType === "poison" && options.onPoisonDamage) {
    next = options.onPoisonDamage(next, resolvedDamage, combatTexts);
  }
  next = applyElementalDamageManaRestore(next, effect.damageType, facts.healthDamage, combatTexts);
  reportEnemyHitDamage(facts, effect.damageType, combatTexts);
  // Shared closer: thresholds then kill payouts (same as other hit paths).
  next = applyHitEpilogue(
    next,
    facts.previousHealth,
    facts.enemyWasAlive,
    combatTexts,
    undefined,
    state.playerStatuses.forge >= 5,
  );
  return { facts, state: next };
}
