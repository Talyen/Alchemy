import type { BattleState } from "./types";

export const ENEMY_TURN_CONSTANTS = {
  IRON_HIDE_OPTIONS_COUNT: 3,
};

export function isEveryOtherTurnScalingTurn(state: { turn: number }): boolean {
  return state.turn % 2 === 0;
}

type FreezeAspect = "regen" | "scaling";

export function isFreezeActiveForAspect(state: BattleState, aspect: FreezeAspect): boolean {
  if (state.enemyCC.freezeSkipTurns <= 0) return false;
  if (aspect === "regen") return state.talentEffects.freezeBlocksRegen;
  return state.talentEffects.freezePreventsEnemyScaling;
}

export function scaleByRoomMultiplier(state: BattleState, value: number): number {
  return Math.round(value * state.roomScalingMultiplier);
}

export function hasEnemyTrait(state: BattleState, traitId: string, traitSet?: ReadonlySet<string>): boolean {
  if (traitSet) return traitSet.has(traitId);
  return state.currentEnemy.traits.some((trait) => trait.id === traitId);
}

export function getEnemyTraitSet(state: BattleState): ReadonlySet<string> {
  return new Set(state.currentEnemy.traits.map((trait) => trait.id));
}
