// Shared encounter trait catalog and mode-specific selection tests.
import { describe, expect, it } from "vitest";
import {
  COMBAT_ENCOUNTER_TRAIT_IDS,
  ENCOUNTER_TRAITS,
  REWARD_ENCOUNTER_TRAIT_IDS,
  pickEncounterTraits,
  sanitizeEncounterTraitIds,
} from "@/lib/content-systems/encounter-traits";

describe("encounter trait catalog", () => {
  it("defines the complete combat and reward pools with stable unique ids", () => {
    expect(COMBAT_ENCOUNTER_TRAIT_IDS).toHaveLength(18);
    expect(REWARD_ENCOUNTER_TRAIT_IDS).toHaveLength(5);
    expect(new Set(Object.keys(ENCOUNTER_TRAITS)).size).toBe(23);
  });

  it("keeps Generous and Scavenger out of Wildwood while allowing its three useful rewards", () => {
    const wildwoodRewards = pickEncounterTraits("wildwood", "reward", 10, () => 0.5);
    expect(wildwoodRewards.sort()).toEqual(["alchemist", "collector", "companion"]);
  });

  it("selects unique traits from the requested mode and category", () => {
    const combat = pickEncounterTraits("labyrinth", "combat", 2, () => 0.75);
    expect(combat).toHaveLength(2);
    expect(new Set(combat).size).toBe(2);
    expect(combat.every((id) => ENCOUNTER_TRAITS[id].category === "combat")).toBe(true);
  });

  it("drops unknown and category-incompatible persisted ids", () => {
    expect(sanitizeEncounterTraitIds(["tempered", "removed-trait", "collector"], "combat")).toEqual([
      "tempered",
    ]);
  });
});
