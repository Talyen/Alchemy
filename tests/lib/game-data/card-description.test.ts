import { describe, expect, it } from "vitest";
import { getEffectiveCardDescriptionLines } from "@/lib/game-data";
import { makeTestCard } from "../../fixtures/cards";

describe("getEffectiveCardDescriptionLines", () => {
  it("returns authored description lines unchanged when no context is given", () => {
    const card = makeTestCard({ descriptionLines: ["Deal 5 Physical damage", "Gain 3 Block"] });
    expect(getEffectiveCardDescriptionLines(card)).toEqual(["Deal 5 Physical damage", "Gain 3 Block"]);
  });

  it("shows base amounts for potions instead of potency-scaled amounts", () => {
    const card = makeTestCard({
      id: "health-potion",
      descriptionLines: ["Restore 8 Health", "Gain 5 Block"],
      effects: [
        { kind: "heal", amount: 8 },
        { kind: "player-status", status: "block", amount: 5 },
      ],
    });
    expect(getEffectiveCardDescriptionLines(card, { potionPotency: 2 })).toEqual(["Restore 8 Health", "Gain 5 Block"]);
  });

  it("shows base damage instead of flat-bonus-adjusted damage", () => {
    const card = makeTestCard({
      descriptionLines: ["Deal 5 Physical damage"],
      effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    expect(getEffectiveCardDescriptionLines(card, { flatPhysicalDamage: 3 })).toEqual(["Deal 5 Physical damage"]);
  });

  it("shows authored companion lines instead of bond-adjusted lines", () => {
    const card = makeTestCard({
      descriptionLines: ["Deals 1 Bleed damage each turn", "Companion"],
      effects: [{ kind: "summon-companion", companionId: "wolf" }],
    });
    expect(
      getEffectiveCardDescriptionLines(card, {
        companionBondLevels: { wolf: 2 },
        companionDamage: 2,
        companionDamageBonus: 1,
        companionDamageBuff: 1,
      }),
    ).toEqual(["Deals 1 Bleed damage each turn", "Companion"]);
  });

  it("leaves scaled and conditional lines exactly as authored", () => {
    const card = makeTestCard({
      descriptionLines: [
        "Deal Holy damage equal to your Block",
        "Gain 2 Block per Mana Crystal",
        "Deal 1 Freeze damage this turn and next turn",
      ],
    });
    expect(getEffectiveCardDescriptionLines(card, { potionPotency: 3, flatPhysicalDamage: 5 })).toEqual([
      "Deal Holy damage equal to your Block",
      "Gain 2 Block per Mana Crystal",
      "Deal 1 Freeze damage this turn and next turn",
    ]);
  });

  it("leaves non-matching lines unchanged", () => {
    const card = makeTestCard({
      descriptionLines: ["Consume", "A mysterious card"],
      effects: [],
    });
    expect(getEffectiveCardDescriptionLines(card)).toEqual(["Consume", "A mysterious card"]);
  });

  it("returns empty array for empty description lines", () => {
    const card = makeTestCard({ descriptionLines: [] });
    expect(getEffectiveCardDescriptionLines(card)).toEqual([]);
  });
});
