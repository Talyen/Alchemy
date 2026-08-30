import { describe, expect, it } from "vitest";
import { ENCOUNTER_TRAITS, REWARD_ENCOUNTER_TRAIT_IDS } from "@/lib/content-systems/encounter-traits";
import { getEnemyModifiersForNodeType, getRewardModifiersForNodeType } from "@/lib/content-systems/labyrinth/modifiers";

describe("ENCOUNTER_TRAITS", () => {
  it("each modifier has a non-empty label and description", () => {
    for (const mod of Object.values(ENCOUNTER_TRAITS)) {
      expect(mod.label.length).toBeGreaterThan(0);
      expect(mod.description.length).toBeGreaterThan(0);
    }
  });
});

describe("getEnemyModifiersForNodeType", () => {
  it("normal combat returns exactly 1 enemy modifier", () => {
    const mods = getEnemyModifiersForNodeType("combat", () => 0.75);
    expect(mods).toHaveLength(1);
  });

  it("elite and boss encounters return exactly 2 enemy modifiers", () => {
    expect(getEnemyModifiersForNodeType("elite", () => 0.75)).toHaveLength(2);
    expect(getEnemyModifiersForNodeType("boss", () => 0.75)).toHaveLength(2);
  });

  it("enemy modifiers never include reward modifier kinds", () => {
    for (const type of ["combat", "elite", "boss"] as const) {
      for (let seed = 1; seed <= 5; seed++) {
        let step = 0;
        const rng = () => ((seed * 9301 + step++ * 49297) % 233280) / 233280;
        const mods = getEnemyModifiersForNodeType(type, rng);
        for (const m of mods) {
          expect((REWARD_ENCOUNTER_TRAIT_IDS as readonly string[]).includes(m)).toBe(false);
          expect(ENCOUNTER_TRAITS[m].category).toBe("combat");
        }
      }
    }
  });

  it("does not return duplicate enemy modifiers", () => {
    for (let seed = 1; seed <= 10; seed++) {
      let step = 0;
      const rng = () => ((seed * 9301 + step++ * 49297) % 233280) / 233280;
      const mods = getEnemyModifiersForNodeType("elite", rng);
      const unique = new Set(mods);
      expect(unique.size).toBe(mods.length);
    }
  });
});

describe("getRewardModifiersForNodeType", () => {
  it("always returns exactly 1 reward modifier", () => {
    const mods = getRewardModifiersForNodeType(() => 0.5);
    expect(mods).toHaveLength(1);
  });

  it("reward modifiers are always reward trait ids", () => {
    for (let seed = 1; seed <= 5; seed++) {
      const rng = () => (seed * 0.19) % 1;
      const mods = getRewardModifiersForNodeType(rng);
      for (const m of mods) {
        expect((REWARD_ENCOUNTER_TRAIT_IDS as readonly string[]).includes(m)).toBe(true);
        expect(ENCOUNTER_TRAITS[m].category).toBe("reward");
      }
    }
  });
});
