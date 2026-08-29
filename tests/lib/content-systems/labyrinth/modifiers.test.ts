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
      for (let trial = 0; trial < 30; trial++) {
        const mods = getEnemyModifiersForNodeType(type, Math.random);
        for (const m of mods) {
          expect((REWARD_ENCOUNTER_TRAIT_IDS as readonly string[]).includes(m)).toBe(false);
        }
      }
    }
  });

  it("does not return duplicate enemy modifiers", () => {
    for (let trial = 0; trial < 100; trial++) {
      const mods = getEnemyModifiersForNodeType("elite", Math.random);
      const unique = new Set(mods);
      expect(unique.size).toBe(mods.length);
    }
  });
});

describe("getRewardModifiersForNodeType", () => {
  it("always returns exactly 1 reward modifier", () => {
    for (let trial = 0; trial < 50; trial++) {
      expect(getRewardModifiersForNodeType(Math.random)).toHaveLength(1);
    }
  });

  it("reward modifiers are always reward trait ids", () => {
    for (let trial = 0; trial < 50; trial++) {
      const mods = getRewardModifiersForNodeType(Math.random);
      for (const m of mods) {
        expect((REWARD_ENCOUNTER_TRAIT_IDS as readonly string[]).includes(m)).toBe(true);
      }
    }
  });
});
