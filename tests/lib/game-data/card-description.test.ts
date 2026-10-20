import { describe, expect, it } from "vitest";
import { cardById, getEffectiveCardDescriptionLines } from "@/lib/game-data";
import { makeTestCard } from "../../fixtures/cards";

describe("getEffectiveCardDescriptionLines", () => {
  it("preserves authored amounts without mutating their copy", () => {
    const card = makeTestCard({
      descriptionLines: ["Restore 8 Health", "Deal Holy damage equal to your Block", "Consume"],
    });
    const before = structuredClone(card);
    const lines = getEffectiveCardDescriptionLines(card);
    expect(lines).toEqual(card.descriptionLines);
    lines[0] = "changed";
    expect(card).toEqual(before);
  });

  it("applies the shared Companion modifiers and preserves trailing copy with exactly one tag", () => {
    const card = makeTestCard({
      descriptionLines: ["Old Companion amount", "Special rule", "Companion", "Companion"],
      effects: [{ kind: "summon-companion", companionId: "wolf" }],
    });
    expect(
      getEffectiveCardDescriptionLines(card, {
        companionBondLevels: { wolf: 2 },
        companionDamageModifiers: { damageBonus: 4, damageMultiplier: 1 },
      }),
    ).toEqual(["Deals 7 Bleed or Physical damage each turn", "Special rule", "Companion"]);
    expect(getEffectiveCardDescriptionLines({ ...card, descriptionLines: [] })).toEqual([
      "Deals 1 Bleed or Physical damage each turn",
      "Companion",
    ]);
  });

  it("shows per-level odds for nested chances instead of implying equal outcomes", () => {
    // Luck Potion resolves 50% Mana, then 50% Gold within the remainder: the
    // flat "Gain X A, B, or C" form would advertise three equal outcomes.
    expect(cardById["luck-potion"]!.descriptionLines).toEqual([
      "50% chance: Gain 4 Mana",
      "Otherwise: Gain 4 Gold or Block",
      "Consume",
    ]);
  });
});
