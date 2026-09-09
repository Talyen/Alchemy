import type { BattleState } from "./types";

export function recordEnemyAbilityUse(state: BattleState, abilityId: string): BattleState {
  if (!state.battleMetrics) return state;
  const counts = state.battleMetrics.enemyAbilityUses ?? {};
  return {
    ...state,
    battleMetrics: {
      ...state.battleMetrics,
      enemyAbilityUses: { ...counts, [abilityId]: (counts[abilityId] ?? 0) + 1 },
    },
  };
}

export function recordEnemyAbilityActivation(state: BattleState, traitId: string): BattleState {
  if (!state.battleMetrics) return state;
  const counts = state.battleMetrics.enemyAbilityActivations;
  return {
    ...state,
    battleMetrics: {
      ...state.battleMetrics,
      enemyAbilityActivations: { ...counts, [traitId]: (counts[traitId] ?? 0) + 1 },
    },
  };
}

export function recordEnemyAttackAction(state: BattleState): BattleState {
  if (!state.battleMetrics) return state;
  return {
    ...state,
    battleMetrics: { ...state.battleMetrics, enemyAttackActions: state.battleMetrics.enemyAttackActions + 1 },
  };
}
