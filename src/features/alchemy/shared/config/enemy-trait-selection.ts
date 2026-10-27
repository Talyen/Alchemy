import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import type { EncounterCombatTraitId } from "@/lib/content-systems/types";
import type { BestiaryEntry } from "./game-data-catalog";

/** Encounter modifiers replace matching native entries, in modifier order. */
export function selectEnemyTraits(entry: Pick<BestiaryEntry, "traits">, modifiers: readonly EncounterCombatTraitId[]) {
  const modifierIds = new Set<string>(modifiers);
  return [
    ...entry.traits.filter((trait) => !modifierIds.has(trait.id)),
    ...modifiers.map((id) => ENCOUNTER_TRAITS[id].enemyTrait),
  ];
}
