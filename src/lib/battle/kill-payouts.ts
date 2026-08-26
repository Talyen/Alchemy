/**
 * Lethality payouts shared by every enemy-damage path (main hits, follow-up
 * typed hits, CC procs, DoT ticks, bleed detonation, mana-crystal burn, wish
 * triggers) so a kill via any source pays the same rewards exactly once per
 * health transition.
 * Leaf-module imports only, so this file stays import-cycle-free.
 */
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

/**
 * Pays Bone Charm heal and gear kill rewards when this transition killed the
 * enemy. Callers pass their own pre-damage aliveness so nested transitions
 * (a sub-proc landing after a lethal main hit) never double-pay.
 */
export function payKillPayouts(
  state: BattleState,
  enemyWasAlive: boolean,
  combatTexts: CombatTextEvent[],
): BattleState {
  const afterBoneCharm = applyBoneCharmHeal(state, enemyWasAlive, combatTexts);
  return applyGearKillRewards(afterBoneCharm, enemyWasAlive, combatTexts);
}
