import { addGoldWithCombatText, applyHealingWithCombatText } from "./combat-text";
import { applyBoneCharmHeal } from "./trinket-effects";
import type { BattleState, CombatTextEvent } from "./types";

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
    nextState = addGoldWithCombatText(nextState, goldOnKill, combatTexts);
  }
  return nextState;
}

export function payKillPayouts(
  state: BattleState,
  enemyWasAlive: boolean,
  combatTexts: CombatTextEvent[],
): BattleState {
  const afterBoneCharm = applyBoneCharmHeal(state, enemyWasAlive, combatTexts);
  return applyGearKillRewards(afterBoneCharm, enemyWasAlive, combatTexts);
}
