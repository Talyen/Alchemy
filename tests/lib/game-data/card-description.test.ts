import { describe, expect, it } from "vitest";
import { getEffectiveCardDescriptionLines } from "@/lib/game-data";
import { makeTestCard } from "../../fixtures/cards";

describe("getEffectiveCardDescriptionLines", () => {
  it("preserves authored amounts and annotates brewed cards without mutating their copy", () => {
    const card = makeTestCard({
      brewed: true,
      descriptionLines: ["Restore 8 Health", "Deal Holy damage equal to your Block", "Consume"],
    });
    const before = structuredClone(card);
    const lines = getEffectiveCardDescriptionLines(card);
    expect(lines).toEqual([...card.descriptionLines, "Brewed: cannot be brewed again"]);
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

  it("labels chance reaction previews conditionally and excludes scheduled hits", () => {
    const reactionPreview = { shatter: "Shatter: destroy all defenses", wildfire: "Wildfire: detonate 15 Burn" };
    const chance = makeTestCard({
      descriptionLines: ["Random attack"],
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [{ kind: "damage", damageType: "nature", amount: 4 }],
          failureEffects: [{ kind: "damage", damageType: "physical", amount: 2 }],
        },
      ],
    });
    expect(getEffectiveCardDescriptionLines(chance, { reactionPreview })).toEqual([
      "Random attack",
      "If the Physical hit resolves: Shatter: destroy all defenses",
      "If the Nature hit resolves: Wildfire: detonate 15 Burn",
    ]);
    const scheduled = makeTestCard({
      descriptionLines: ["Later attack"],
      effects: [
        {
          kind: "repeat-over-turns",
          remainingTurns: 1,
          effects: [{ kind: "damage", damageType: "nature", amount: 4 }],
        },
      ],
    });
    expect(getEffectiveCardDescriptionLines(scheduled, { reactionPreview })).toEqual(["Later attack"]);
  });
});
