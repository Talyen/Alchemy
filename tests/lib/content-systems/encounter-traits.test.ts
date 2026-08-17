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
  it("keeps unique combat and reward ids aligned with the catalog", () => {
    expect(new Set(COMBAT_ENCOUNTER_TRAIT_IDS).size).toBe(COMBAT_ENCOUNTER_TRAIT_IDS.length);
    expect(new Set(REWARD_ENCOUNTER_TRAIT_IDS).size).toBe(REWARD_ENCOUNTER_TRAIT_IDS.length);
    expect(Object.keys(ENCOUNTER_TRAITS).sort()).toEqual(
      [...COMBAT_ENCOUNTER_TRAIT_IDS, ...REWARD_ENCOUNTER_TRAIT_IDS].sort(),
    );
    expect(COMBAT_ENCOUNTER_TRAIT_IDS.every((id) => ENCOUNTER_TRAITS[id].category === "combat")).toBe(true);
    expect(REWARD_ENCOUNTER_TRAIT_IDS.every((id) => ENCOUNTER_TRAITS[id].category === "reward")).toBe(true);
  });

  it("keeps Generous and Scavenger out of Wildwood while allowing its useful rewards", () => {
    const wildwoodRewards = pickEncounterTraits("wildwood", "reward", 10, () => 0.5);
    expect(wildwoodRewards.sort()).toEqual(["alchemist", "companion"]);
  });

  it("selects unique traits from the requested mode and category", () => {
    const combat = pickEncounterTraits("labyrinth", "combat", 2, () => 0.75);
    expect(combat).toHaveLength(2);
    expect(new Set(combat).size).toBe(2);
    expect(combat.every((id) => ENCOUNTER_TRAITS[id].category === "combat")).toBe(true);
  });

  it("drops unknown and category-incompatible persisted ids", () => {
    expect(sanitizeEncounterTraitIds(["tempered", "removed-trait", "collector"], "combat")).toEqual(["tempered"]);
  });
});
