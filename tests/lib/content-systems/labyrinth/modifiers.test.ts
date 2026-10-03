import { expect, it } from "vitest";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import {
  areLabyrinthTraitsCompatible,
  getEnemyModifiersForNodeType,
  getRewardModifiersForNodeType,
  isLabyrinthTraitEligible,
} from "@/lib/content-systems/labyrinth/modifiers";
import { createSeededRng } from "@/lib/rng";

it("fills encounter slots with distinct combat modifiers compatible with native traits and each other", () => {
  const native = ["starting-block", "banshee", "thornhide", "plated"];
  for (const type of ["combat", "elite", "boss"] as const) {
    for (let seed = 1; seed <= 64; seed++) {
      const mods = getEnemyModifiersForNodeType(type, createSeededRng(seed), native);
      expect(mods, `${type}, seed ${seed}`).toHaveLength(type === "combat" ? 1 : 2);
      expect(new Set(mods).size).toBe(mods.length);
      expect(mods).not.toEqual(expect.arrayContaining(["shielded-arrival"]));
      expect(mods).not.toEqual(expect.arrayContaining(["unbinding-strike"]));
      for (const id of mods) {
        expect(ENCOUNTER_TRAITS[id].category).toBe("combat");
        expect(isLabyrinthTraitEligible(id, type)).toBe(true);
        expect(
          [...native, ...mods.filter((other) => other !== id)].every((other) =>
            areLabyrinthTraitsCompatible(id, other),
          ),
        ).toBe(true);
      }
    }
  }
});

it("offers valid room rewards without announcing premium Hoards before their depth gates", () => {
  for (const depth of [1, 30]) {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 256; seed++) {
      const mods = getRewardModifiersForNodeType(createSeededRng(seed), "combat", depth);
      expect(mods).toHaveLength(1);
      for (const id of mods) {
        seen.add(id);
        expect(ENCOUNTER_TRAITS[id].category).toBe("reward");
        expect(isLabyrinthTraitEligible(id, "combat")).toBe(true);
      }
    }
    if (depth === 1) {
      for (const id of ["masterwork", "astral-hoard", "trinket-hoard", "unique-hoard"])
        expect(seen.has(id)).toBe(false);
    } else {
      for (const id of ["astral-hoard", "trinket-hoard", "unique-hoard"]) expect(seen.has(id)).toBe(true);
    }
  }
});
