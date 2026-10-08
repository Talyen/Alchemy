import type { BattleState, EnemyMitigation } from "./types";
import { BATTLE_CONFIG, MIN_ARMOR_AMOUNT } from "../game-constants";
import { hasEnemyTrait } from "./encounter-trait-state";
export function addEnemyMitigation(state: BattleState, field: keyof EnemyMitigation, delta: number): BattleState {
  return {
    ...state,
    enemyMitigation: {
      ...state.enemyMitigation,
      [field]: state.enemyMitigation[field] + delta,
    },
  };
}

function stripEnemyMitigation(state: BattleState, field: keyof EnemyMitigation): BattleState {
  if (state.enemyMitigation[field] <= 0) return state;
  return { ...state, enemyMitigation: { ...state.enemyMitigation, [field]: 0 } };
}

export function stripEnemyArmor(state: BattleState): BattleState {
  return stripEnemyMitigation(state, "armor");
}

export function stripEnemyBlock(state: BattleState): BattleState {
  return stripEnemyMitigation(state, "block");
}

export function reduceEnemyArmor(state: BattleState, delta: number): BattleState {
  if (delta <= 0 || state.enemyMitigation.armor <= 0) return state;
  return {
    ...state,
    enemyMitigation: {
      ...state.enemyMitigation,
      armor: Math.max(0, state.enemyMitigation.armor - delta),
    },
  };
}

export function decayEnemyArmor(state: BattleState): BattleState {
  if (hasEnemyTrait(state, "unbreakable") || state.enemyMitigation.armor <= MIN_ARMOR_AMOUNT) {
    return state;
  }
  return reduceEnemyArmor(state, BATTLE_CONFIG.ARMOR_DECAY_AMOUNT);
}

export const EMPTY_ENEMY_MITIGATION: EnemyMitigation = { armor: 0, forge: 0, block: 0 };
