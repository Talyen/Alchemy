import { describe, expect, it } from "vitest";
import { companionLibrary, getCompanionDescriptionLines } from "@/lib/game-data";

it("describes pooled damage after applying Bond and typed modifiers once", () => {
  const original = structuredClone(companionLibrary.wolf);
  expect(
    getCompanionDescriptionLines(companionLibrary.wolf, 2, {
      damageBonus: 1,
      bleedDamageBonus: 1,
      damageMultiplier: 2,
    }),
  ).toEqual(["Deals 10 Bleed damage or Deals 8 Physical damage each turn"]);
  expect(companionLibrary.wolf).toEqual(original);
});

describe("Bond descriptions", () => {
  it.each([0, 3])("describes every effect at Bond %i", (level) => {
    expect(getCompanionDescriptionLines(companionLibrary.wolf, level)).toEqual([
      `Deals ${1 + level} Bleed or Physical damage each turn`,
    ]);
    expect(getCompanionDescriptionLines(companionLibrary.panther, level)).toEqual([
      `Deals ${1 + level} Bleed damage each turn`,
    ]);
    expect(getCompanionDescriptionLines(companionLibrary["will-o-wisp"], level)).toEqual([
      level === 0
        ? "Cleanses 1 harmful status effect each turn"
        : `Cleanses 1 harmful status effect and restores ${level} Health each turn`,
    ]);
    expect(getCompanionDescriptionLines(companionLibrary.fox, level)).toEqual([
      `Deals ${1 + level} Stun or Bleed damage each turn`,
    ]);
    for (const [id, baseline, action] of [
      ["mana-moth", "Gain 1 Mana each turn", "grant"],
      ["library-owl", "Draw a Card each turn", "draw"],
    ] as const) {
      expect(getCompanionDescriptionLines(companionLibrary[id], level)).toEqual([
        baseline +
          (level === 0 ? "" : `, with a ${level * 25}% chance to ${action} 1 more`) +
          (id === "mana-moth" ? ", allowing overflow" : ""),
      ]);
    }
  });
});
