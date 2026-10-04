import { expect, it } from "vitest";
import { ENCOUNTER_TRAITS, eligibleEncounterTraitIds } from "@/lib/content-systems/encounter-traits";
import {
  areLabyrinthTraitsCompatible,
  getEnemyModifiersForNodeType,
  getRewardModifiersForNodeType,
  isLabyrinthTraitEligible,
} from "@/lib/content-systems/labyrinth/modifiers";
import { LABYRINTH_SUPPORT_TYPES } from "@/lib/content-systems/labyrinth/data";
import { createSeededRng } from "@/lib/rng";

it("fills encounter slots with distinct combat modifiers compatible with native traits and each other", () => {
  const native = ["starting-block", "banshee", "thornhide", "plated", "tempered", "vampire"];
  for (const type of ["combat", "elite", "boss"] as const) {
    for (let seed = 1; seed <= 64; seed++) {
      const mods = getEnemyModifiersForNodeType(type, createSeededRng(seed), native);
      expect(mods, `${type}, seed ${seed}`).toHaveLength(type === "combat" ? 1 : 2);
      expect(new Set(mods).size).toBe(mods.length);
      expect(mods).not.toEqual(expect.arrayContaining(["shielded-arrival"]));
      for (const forbidden of ["unbinding-strike", "whitehot", "ravenous"]) expect(mods).not.toContain(forbidden);
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

it("covers every reward bucket and excludes premium Hoards before their depth gates", () => {
  const premium = new Set(["masterwork", "astral-hoard", "trinket-hoard", "unique-hoard"]);
  for (const type of ["combat", "elite", "boss", "entrance", ...LABYRINTH_SUPPORT_TYPES] as const) {
    const latePool = eligibleEncounterTraitIds("labyrinth", "reward").filter((id) =>
      isLabyrinthTraitEligible(id, type),
    );
    for (const depth of [1, 30]) {
      const expected = depth === 1 ? latePool.filter((id) => !premium.has(id)) : latePool;
      // Visit the midpoint of every uniform bucket, so a missing or extra offer
      // cannot hide behind a seed that happens not to select it.
      const offered = expected.flatMap((_, index) =>
        getRewardModifiersForNodeType(() => (index + 0.5) / expected.length, type, depth),
      );
      expect(offered, `${type} at depth ${depth}`).toEqual(expected);
      if (!expected.length) {
        expect(
          getRewardModifiersForNodeType(
            () => {
              throw new Error("Empty pool must not draw");
            },
            type,
            depth,
          ),
        ).toEqual([]);
      }
    }
  }
});
