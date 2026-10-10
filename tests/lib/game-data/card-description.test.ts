import { describe, expect, it } from "vitest";
import { cardLibrary, getEffectiveCardDescriptionLines, keywordDefinitions } from "@/lib/game-data";
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
        companionDamageModifiers: { damageBonus: 4, bleedDamageBonus: 0, damageMultiplier: 1 },
      }),
    ).toEqual(["Deals 7 Bleed or Physical damage each turn", "Special rule", "Companion"]);
    expect(getEffectiveCardDescriptionLines({ ...card, descriptionLines: [] })).toEqual([
      "Deals 1 Bleed or Physical damage each turn",
      "Companion",
    ]);
  });

  it("keeps universal reactions out of card descriptions and keyword explanations", () => {
    const context = {
      companionBondLevels: {},
      reactionPreview: { shatter: "Shatter: destroy all defenses", wildfire: "Wildfire: detonate 15 Burn" },
    };
    for (const card of cardLibrary) {
      expect(getEffectiveCardDescriptionLines(card, context).join("\n"), card.id).not.toMatch(
        /\b(?:Shatter|Wildfire)\b/i,
      );
    }
    for (const definition of Object.values(keywordDefinitions)) {
      expect(definition.description, definition.id).not.toMatch(/\b(?:Shatter|Wildfire)\b/i);
    }
  });
});
