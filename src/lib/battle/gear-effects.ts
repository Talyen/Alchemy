import type { GearEffectManifest } from "@/lib/gear";
import { PERCENT_DENOMINATOR } from "../game-constants";
import { applyHealingWithCombatText, mergeCombatText } from "./combat-text";
import { getEnemyDamageMultiplier } from "./status-helpers";
import { applyLuckyCloverGold } from "./trinket-effects";
import { clampHealth, scaleGoldReward, type BattleState, type CombatTextEvent } from "./types";

export function applyGearKillRewards(
  state: BattleState,
  enemyWasAlive: boolean,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (state.enemyHealth > 0 || !enemyWasAlive) return state;
  let nextState = state;
  const { healOnKill, goldOnKill, healOnBurnEnemyDefeated } = state.gearEffects;
  if (healOnKill > 0) {
    nextState = applyHealingWithCombatText(nextState, healOnKill, combatTexts);
  }
  if (healOnBurnEnemyDefeated > 0 && state.enemyStatuses.burn > 0) {
    nextState = applyHealingWithCombatText(nextState, healOnBurnEnemyDefeated, combatTexts);
  }
  if (goldOnKill > 0) {
    const adjustedGold = scaleGoldReward(goldOnKill, nextState.gearEffects);
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: adjustedGold });
    nextState = { ...nextState, gold: nextState.gold + adjustedGold };
  }
  return nextState;
}

export function gearFrozenDamageMultiplier(state: BattleState): number {
  if (state.enemyCC.freezeSkipTurns <= 0 || state.gearEffects.frozenEnemyDamageBonusPercent <= 0) return 1;
  return 1 + state.gearEffects.frozenEnemyDamageBonusPercent / PERCENT_DENOMINATOR;
}

export function applyGearProcPhysicalDamage(state: BattleState, baseDamage: number, damageType = "physical"): number {
  const multiplier = getEnemyDamageMultiplier(state, damageType) * gearFrozenDamageMultiplier(state);
  return Math.round(baseDamage * multiplier);
}

export function scaledGearLeechHeal(baseHeal: number, gear: GearEffectManifest): number {
  if (gear.leechHealBonusPercent <= 0) return baseHeal;
  return Math.round(baseHeal * (1 + gear.leechHealBonusPercent / PERCENT_DENOMINATOR));
}

/**
 * Deals gear-on-Crowd-Control physical damage (freeze / stun procs), clamping
 * enemy health and paying kill rewards when the hit is lethal. Freeze keeps
 * lucky-clover gold off by default; stun opts in via `grantLuckyClover`.
 */
export function applyGearCcPhysicalDamage(
  state: BattleState,
  gearDamage: number,
  combatTexts: CombatTextEvent[],
  options: { grantLuckyClover?: boolean } = {},
): BattleState {
  if (gearDamage <= 0) return state;
  const enemyWasAlive = state.enemyHealth > 0;
  const finalDamage = applyGearProcPhysicalDamage(state, gearDamage);
  mergeCombatText(combatTexts, {
    target: "enemy",
    kind: "damage",
    stat: "physical",
    amount: finalDamage,
  });
  let nextState = {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, -finalDamage, state.enemyMaxHealth),
  };
  if (options.grantLuckyClover) {
    nextState = applyLuckyCloverGold(nextState, finalDamage, combatTexts);
  }
  if (enemyWasAlive && nextState.enemyHealth <= 0) {
    nextState = applyGearKillRewards(nextState, true, combatTexts);
  }
  return nextState;
}
