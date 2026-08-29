import { pickEncounterTraits, type EncounterCombatTraitId, type EncounterRewardTraitId } from "../encounter-traits";

export function getEnemyModifiersForNodeType(
  type: "combat" | "elite" | "boss",
  rng: () => number,
): EncounterCombatTraitId[] {
  return pickEncounterTraits("labyrinth", "combat", type === "combat" ? 1 : 2, rng);
}

export function getRewardModifiersForNodeType(rng: () => number): EncounterRewardTraitId[] {
  return pickEncounterTraits("labyrinth", "reward", 1, rng);
}
