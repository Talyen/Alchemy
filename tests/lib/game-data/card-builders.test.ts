import { describe, expect, it } from "vitest";
import {
  archeryDamageCard,
  consumableCard,
  damageCard,
  dualDamageCard,
  effectsCard,
  singleEffectCard,
} from "@/lib/game-data/cards/card-builders";

describe("card builders", () => {
  it("builds a lifesteal damage card with a shared Leech line", () => {
    const card = damageCard({ id: "bloodthorn", art: "bloodthorn", damageType: "nature", amount: 3, lifesteal: true });
    expect(card.title).toBe("Bloodthorn");
    expect(card.descriptionLines).toEqual(["Deal 3 Nature damage", "Leech"]);
    expect(card.effects).toEqual([{ kind: "damage", damageType: "nature", amount: 3, lifesteal: true }]);
  });

  it("passes lifesteal through archery cards with the Archery tag", () => {
    const card = archeryDamageCard({
      id: "sap-arrow",
      art: "sap-arrow",
      damageType: "nature",
      amount: 2,
      lifesteal: true,
    });
    expect(card.descriptionLines).toEqual(["Deal 2 Nature damage", "Leech", "Archery"]);
    expect(card.tags).toEqual(["archery"]);
  });

  it("shares one Leech line across dual lifesteal hits", () => {
    const card = dualDamageCard({
      id: "fangs",
      art: "fangs",
      hits: [
        { damageType: "bleed", amount: 2, lifesteal: true },
        { damageType: "physical", amount: 1, lifesteal: true },
      ],
    });
    expect(card.descriptionLines).toEqual(["Deal 2 Bleed damage", "Deal 1 Physical damage", "Leech"]);
    expect(card.effects).toEqual([
      { kind: "damage", damageType: "bleed", amount: 2, lifesteal: true },
      { kind: "damage", damageType: "physical", amount: 1, lifesteal: true },
    ]);
  });

  it("builds multi-effect consumables with a single Consume line", () => {
    const card = consumableCard({
      id: "mana-berries",
      art: "mana-berries",
      effects: [
        { kind: "restore-mana", amount: 1 },
        { kind: "draw-cards", amount: 1 },
      ],
    });
    expect(card.descriptionLines).toEqual(["Gain 1 Mana", "Draw a card", "Consume"]);
    expect(card.consume).toBe(true);
  });

  it("supports explicit lines for effects with no canonical phrasing", () => {
    const card = effectsCard({
      id: "maul",
      art: "maul",
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [{ kind: "damage", damageType: "stun", amount: 3 }],
          failureEffects: [{ kind: "damage", damageType: "bleed", amount: 3 }],
        },
      ],
      descriptionLines: ["Deal 3 Stun or Bleed damage at random"],
    });
    expect(card.descriptionLines).toEqual(["Deal 3 Stun or Bleed damage at random"]);
  });

  it("generates canonical lines for the simple kinds", () => {
    const card = effectsCard({
      id: "cauterize",
      art: "cauterize",
      effects: [
        { kind: "remove-harmful-status", amount: 2 },
        { kind: "self-damage", damageType: "burn", amount: 1 },
      ],
    });
    expect(card.descriptionLines).toEqual(["Cleanse 2 harmful status effects", "Take 1 Burn damage"]);
  });

  it("keeps custom single-effect lines for haste-style effects", () => {
    const card = singleEffectCard({
      id: "haste",
      art: "haste",
      effect: { kind: "player-status", status: "haste", amount: 1 },
      descriptionLine: "Take an extra turn after this one",
    });
    expect(card.descriptionLines).toEqual(["Take an extra turn after this one"]);
  });

  it("throws for effects with no canonical line when no explicit lines are given", () => {
    expect(() =>
      effectsCard({
        id: "bad",
        art: "bad",
        effects: [{ kind: "chance", probability: 0.5, successEffects: [], failureEffects: [] }],
      }),
    ).toThrow("unsupported effect kind");
  });
});
