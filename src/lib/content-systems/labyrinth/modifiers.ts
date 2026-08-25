// Labyrinth encounter trait cadence built on the shared content-system trait catalog.
import { pickEncounterTraits, type EncounterCombatTraitId, type EncounterRewardTraitId } from "../encounter-traits";

export function getEnemyModifiersForNodeType(
  type: "combat" | "elite" | "boss",
  rng: () => number,
): EncounterCombatTraitId[] {
  return pickEncounterTraits("labyrinth", "combat", type === "combat" ? 1 : 2, rng);
}

export function getRewardModifiersForNodeType(
  type: "combat" | "elite" | "boss",
  rng: () => number,
): EncounterRewardTraitId[] {
  if (type === "boss" || (type === "combat" && rng() < 0.5)) return [];
  return pickEncounterTraits("labyrinth", "reward", 1, rng);
}
