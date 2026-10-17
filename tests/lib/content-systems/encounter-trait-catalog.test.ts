import { describe, expect, it } from "vitest";
import {
  eligibleEncounterTraitIds,
  pickEncounterTrait,
  sanitizeEncounterTraitIds,
  sanitizePersistedEnemyTraits,
} from "@/lib/content-systems/encounter-traits";

describe("encounter trait catalog", () => {
  it("keeps every eligible labyrinth and Wildwood trait pool non-empty", () => {
    for (const mode of ["labyrinth", "wildwood"] as const) {
      for (const category of ["combat", "reward"] as const) {
        const pool = eligibleEncounterTraitIds(mode, category);
        expect(pool.length, `${mode} ${category}`).toBeGreaterThan(0);
        let draws = 0;
        const selected = pickEncounterTrait(mode, category, () => {
          draws += 1;
          return 0.5;
        });
        expect(pool).toContain(selected);
        expect(draws, `${mode} ${category}`).toBe(1);
      }
    }
  });

  it("keeps Generous and Scavenger out of Wildwood while allowing its useful rewards", () => {
    expect(eligibleEncounterTraitIds("wildwood", "reward").sort()).toEqual(["alchemist", "companion"]);
  });

  it("drops unknown, category-incompatible, and object prototype persisted ids without error", () => {
    expect(
      sanitizeEncounterTraitIds(
        ["tempered", "removed-trait", "collector", "wealthy", "toString", "valueOf", "__proto__"],
        "combat",
      ),
    ).toEqual(["tempered"]);
  });

  it("filters out retired enemy traits from persisted lists", () => {
    const activeTrait = { id: "normal-trait", title: "Normal", description: "Trait" };
    const retiredTrait = { id: "armored", title: "Armored", description: "Retired" };
    const retiredWealthy = { id: "wealthy", title: "Wealthy", description: "Retired" };
    expect(sanitizePersistedEnemyTraits([activeTrait, retiredTrait, retiredWealthy])).toEqual([activeTrait]);
  });
});
