import type { GearEffectManifest } from "@/lib/gear";
import { PERCENT_DENOMINATOR } from "../game-constants";
import { emitOverhealBlockText, mergeCombatText } from "./combat-text";
import { getEnemyDamageMultiplier } from "./status-helpers";
import { applyPlayerHealing, scaleGoldReward, type BattleState, type CombatTextEvent } from "./types";

export function applyGearKillRewards(
  state: BattleState,
  enemyWasAlive: boolean,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (state.enemyHealth > 0 || !enemyWasAlive) return state;
  let nextState = state;
  const { healOnKill, goldOnKill, healOnBurnEnemyDefeated } = state.gearEffects;
  if (healOnKill > 0) {
    const prevState = nextState;
    nextState = applyPlayerHealing(nextState, healOnKill);
    mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healOnKill });
    emitOverhealBlockText(prevState, nextState, combatTexts);
  }
  if (healOnBurnEnemyDefeated > 0 && state.enemyStatuses.burn > 0) {
    const prevState = nextState;
    nextState = applyPlayerHealing(nextState, healOnBurnEnemyDefeated);
    mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healOnBurnEnemyDefeated });
    emitOverhealBlockText(prevState, nextState, combatTexts);
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
