import { describe, expect, it } from "vitest";
import { cardLibrary, companionLibrary } from "@/lib/game-data";
import { cardSounds, getCardSounds } from "@/lib/audio/sound-registry";

describe("complete focal sound coverage", () => {
  it("every card has a nonempty cue registration, without stale content keys", () => {
    expect(Object.keys(cardSounds).sort()).toEqual(cardLibrary.map((card) => card.id).sort());
    expect(Object.values(cardSounds).every((sounds) => sounds.length > 0)).toBe(true);
  });

  it("maps every companion to its summoning cue", () => {
    for (const id of Object.keys(companionLibrary)) {
      expect(cardSounds[`${id}-companion`]?.length).toBeGreaterThan(0);
    }
  });
});

it("treats unknown saved card IDs as silent while resolving crafted Mixed Potions", () => {
  for (const id of ["missing", "constructor", "toString", "__proto__"]) expect(getCardSounds(id)).toEqual([]);
  expect(getCardSounds("mixed-potion-crafted")).toEqual(cardSounds["mixed-potion"]);
});
