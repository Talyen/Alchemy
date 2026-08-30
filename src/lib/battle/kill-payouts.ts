import { emitOverhealBlockText, mergeCombatText } from "./combat-text-events";
import { paceCombatMagnitude } from "./fight-pacing";
import { applyPlayerHealing, scaleGoldReward, type BattleState, type CombatTextEvent } from "./types";

function applyKillRewardHealing(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  if (amount <= 0) return state;
  const previousState = state;
  const nextState = applyPlayerHealing(state, paceCombatMagnitude(state, amount, "player"));
  const actualHeal = nextState.playerHealth - previousState.playerHealth;
  if (actualHeal > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: actualHeal });
  }
  emitOverhealBlockText(previousState, nextState, combatTexts);
  return nextState;
}

function applyKillRewardGold(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
  if (amount <= 0) return state;
  const scaledGold = scaleGoldReward(amount, state.gearEffects);
  if (scaledGold > 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: scaledGold });
  }
  return { ...state, gold: state.gold + scaledGold };
}

export function applyGearKillRewards(
  state: BattleState,
  enemyWasAlive: boolean,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (state.enemyHealth > 0 || !enemyWasAlive) return state;
  let nextState = state;
  const { healOnKill, goldOnKill, healOnBurnEnemyDefeated } = state.gearEffects;
  if (healOnKill > 0) {
    nextState = applyKillRewardHealing(nextState, healOnKill, combatTexts);
  }
  if (healOnBurnEnemyDefeated > 0 && state.enemyStatuses.burn > 0) {
    nextState = applyKillRewardHealing(nextState, healOnBurnEnemyDefeated, combatTexts);
  }
  if (goldOnKill > 0) {
    nextState = applyKillRewardGold(nextState, goldOnKill, combatTexts);
  }
  return nextState;
}

export function payKillPayouts(
  state: BattleState,
  enemyWasAlive: boolean,
  combatTexts: CombatTextEvent[],
): BattleState {
  const afterBoneCharm =
    state.enemyHealth <= 0 && enemyWasAlive
      ? applyKillRewardHealing(state, state.trinketEffects.boneCharmHealOnKill, combatTexts)
      : state;
  return applyGearKillRewards(afterBoneCharm, enemyWasAlive, combatTexts);
}
