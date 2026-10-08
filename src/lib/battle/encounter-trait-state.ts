import type { BattleState } from "./types";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
// Trait lists are immutable battle inputs. Key by the list so state copies
// reuse the lookup, replacement lists invalidate it, and old battles can be collected.
const enemyTraitSets = new WeakMap<BattleState["currentEnemy"]["traits"], ReadonlySet<string>>();

export function hasEnemyTrait(state: BattleState, traitId: string, traitSet?: ReadonlySet<string>): boolean {
  return (traitSet ?? getEnemyTraitSet(state)).has(traitId);
}

export function getEnemyTraitSet(state: Pick<BattleState, "currentEnemy">): ReadonlySet<string> {
  const traits = state.currentEnemy.traits;
  let set = enemyTraitSets.get(traits);
  if (!set) {
    set = new Set(traits.map((trait) => trait.id));
    enemyTraitSets.set(traits, set);
  }
  return set;
}

export function hasEncounterBenefit(
  state: Pick<BattleState, "encounterBenefits">,
  id: EncounterRewardTraitId,
): boolean {
  return state.encounterBenefits.includes(id);
}
