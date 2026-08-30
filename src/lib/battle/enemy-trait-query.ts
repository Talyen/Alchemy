import type { BattleState } from "./types";

export function hasEnemyTrait(state: BattleState, traitId: string, traitSet?: ReadonlySet<string>): boolean {
  if (traitSet) return traitSet.has(traitId);
  return state.currentEnemy.traits.some((trait) => trait.id === traitId);
}

export function getEnemyTraitSet(state: BattleState): ReadonlySet<string> {
  return new Set(state.currentEnemy.traits.map((trait) => trait.id));
}
