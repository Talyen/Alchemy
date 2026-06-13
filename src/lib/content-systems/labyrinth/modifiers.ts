// Labyrinth encounter trait cadence built on the shared content-system trait catalog.
import {
  ENCOUNTER_TRAITS,
  REWARD_ENCOUNTER_TRAIT_IDS,
  pickEncounterTraits,
  type EncounterCombatTraitId,
  type EncounterRewardTraitId,
} from "../encounter-traits";

export const ALL_LABYRINTH_MODIFIERS = ENCOUNTER_TRAITS;
export const REWARD_MODIFIER_KINDS: ReadonlySet<EncounterRewardTraitId> = new Set(REWARD_ENCOUNTER_TRAIT_IDS);

export function getEnemyModifiersForNodeType(
  type: "combat" | "elite" | "boss",
  rng: () => number = Math.random,
): EncounterCombatTraitId[] {
  return pickEncounterTraits("labyrinth", "combat", type === "combat" ? 1 : 2, rng) as EncounterCombatTraitId[];
}

export function getRewardModifiersForNodeType(
  type: "combat" | "elite" | "boss",
  rng: () => number = Math.random,
): EncounterRewardTraitId[] {
  if (type === "boss" || (type === "combat" && rng() < 0.5)) return [];
  return pickEncounterTraits("labyrinth", "reward", 1, rng) as EncounterRewardTraitId[];
}

/** Combat traits are attached to enemies directly; no difficulty conversion remains. */
export function labyrinthModifiersToDifficulty(): [] {
  return [];
}
