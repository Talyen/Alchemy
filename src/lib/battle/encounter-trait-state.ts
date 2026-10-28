import type { BattleState } from "./types";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import { isDeeplyFrozenData } from "@/lib/immutable-data";
// Published battle inputs are frozen, but owned setup copies may be edited.
// Keep identity-stable lookups while invalidating changes to mutable trait IDs.
const enemyTraitSets = new WeakMap<
  BattleState["currentEnemy"]["traits"],
  { ids: string[]; frozen: boolean; lookup: ReadonlySet<string> }
>();

function readonlyTraitSet(traits: BattleState["currentEnemy"]["traits"]): ReadonlySet<string> {
  const source = new Set<string>();
  for (const trait of traits) source.add(trait.id);
  // Freezing a Set does not protect its internal slots. Expose read operations
  // only, including a forEach callback that cannot borrow the backing Set.
  const view: ReadonlySet<string> = Object.freeze({
    size: source.size,
    has: (value: string) => source.has(value),
    keys: () => source.keys(),
    values: () => source.values(),
    entries: () => source.entries(),
    [Symbol.iterator]: () => source[Symbol.iterator](),
    forEach: (callback: (value: string, key: string, set: ReadonlySet<string>) => void, thisArg?: unknown) => {
      source.forEach((value) => callback.call(thisArg, value, value, view));
    },
  });
  return view;
}

export function hasEnemyTrait(state: BattleState, traitId: string, traitSet?: ReadonlySet<string>): boolean {
  return (traitSet ?? getEnemyTraitSet(state)).has(traitId);
}

export function getEnemyTraitSet(state: Pick<BattleState, "currentEnemy">): ReadonlySet<string> {
  const traits = state.currentEnemy.traits;
  const cached = enemyTraitSets.get(traits);
  if (
    cached &&
    (cached.frozen || (cached.ids.length === traits.length && cached.ids.every((id, i) => traits[i]?.id === id)))
  )
    return cached.lookup;
  const lookup = readonlyTraitSet(traits);
  enemyTraitSets.set(traits, { ids: traits.map((trait) => trait.id), frozen: isDeeplyFrozenData(traits), lookup });
  return lookup;
}

export function hasEncounterBenefit(
  state: Pick<BattleState, "encounterBenefits">,
  id: EncounterRewardTraitId,
): boolean {
  return state.encounterBenefits.includes(id);
}
