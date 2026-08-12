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
 * Shared "deal scaled enemy damage" helper: applies an optional per-hit
 * multiplier, emits enemy damage combat text, and clamps enemy health to 0.
 * Callers pass their bespoke post-clamp riders (lucky-clover gold, kill
 * rewards, encounter-trait thresholds) via `riders`.
 */
export interface DealEnemyScaledDamageOptions {
  multiplier?: number;
  riders?: (state: BattleState, finalDamage: number, combatTexts: CombatTextEvent[]) => BattleState;
}

export function dealEnemyScaledDamage(
  state: BattleState,
  baseDamage: number,
  stat: "physical" | "burn" | "nature",
  combatTexts: CombatTextEvent[],
  options: DealEnemyScaledDamageOptions = {},
): BattleState {
  if (baseDamage <= 0) return state;
  const finalDamage = Math.round(baseDamage * (options.multiplier ?? 1));
  if (finalDamage > 0) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat, amount: finalDamage });
  }
  const nextState = {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, -finalDamage, state.enemyMaxHealth),
  };
  return options.riders ? options.riders(nextState, finalDamage, combatTexts) : nextState;
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
  return dealEnemyScaledDamage(state, gearDamage, "physical", combatTexts, {
    multiplier: getEnemyDamageMultiplier(state, "physical") * gearFrozenDamageMultiplier(state),
    riders: (nextState, finalDamage, texts) => {
      let result = options.grantLuckyClover ? applyLuckyCloverGold(nextState, finalDamage, texts) : nextState;
      if (enemyWasAlive && result.enemyHealth <= 0) {
        result = applyGearKillRewards(result, true, texts);
      }
      return result;
    },
  });
}
