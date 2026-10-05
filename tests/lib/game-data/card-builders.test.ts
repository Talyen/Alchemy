import { validateCardDescriptionParity } from "@/lib/content-validation/card-parity";
import { canonicalCardDescriptionMatches, cardMagnitude, type CardDescription } from "@/lib/game-data";
import { damageCard, effectsCard } from "@/lib/game-data/cards/card-builders";
import { describe, expect, it } from "vitest";

describe("card builders", () => {
  it("passes lifesteal through archery cards with the Archery tag", () => {
    const card = damageCard({
      id: "sap-arrow",
      art: "sap-arrow",
      damageType: "nature",
      amount: 2,
      lifesteal: true,
      tags: ["archery"],
    });
    expect(card.descriptionLines).toEqual(["Deal 2 Nature damage", "Leech", "Archery"]);
    expect(card.tags).toEqual(["archery"]);
  });

  it("shares one Leech line across dual lifesteal hits", () => {
    const card = effectsCard({
      id: "fangs",
      art: "fangs",
      effects: [
        { kind: "damage", damageType: "bleed", amount: 2, lifesteal: true },
        { kind: "damage", damageType: "physical", amount: 1, lifesteal: true },
      ],
    });
    expect(card.descriptionLines).toEqual(["Deal 2 Bleed damage", "Deal 1 Physical damage", "Leech"]);
    expect(card.effects).toEqual([
      { kind: "damage", damageType: "bleed", amount: 2, lifesteal: true },
      { kind: "damage", damageType: "physical", amount: 1, lifesteal: true },
    ]);
  });

  it("owns custom description lines so building or editing a variant cannot change another card", () => {
    const authored: CardDescription = [
      {
        parts: ["Restore ", cardMagnitude({ kind: "heal", effectIndex: 0, field: "amount" }), " Health"],
        role: "effect",
      },
    ];
    const before = structuredClone(authored);
    const base = { id: "shared", art: "", effects: [{ kind: "heal" as const, amount: 2 }], describe: () => authored };
    const tagged = effectsCard({ ...base, tags: ["nature"], consume: true });
    const plain = effectsCard(base);
    expect(tagged.descriptionLines).toEqual(["Restore 2 Health", "Nature", "Consume"]);
    expect(plain.descriptionLines).toEqual(["Restore 2 Health"]);
    tagged.descriptionLines[0] = "Changed";
    plain.descriptionLines.push("Changed");
    tagged.description![0]!.parts[0] = "Changed";
    expect(authored).toEqual(before);
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
      describe: () => [
        {
          parts: [
            "Deal ",
            cardMagnitude({ effectIndex: 0, effectPath: [0], kind: "damage", field: "amount" }),
            " Stun or ",
            cardMagnitude({ effectIndex: 0, effectPath: [1], kind: "damage", field: "amount" }),
            " Bleed damage at random",
          ],
          role: "effect",
        },
      ],
    });
    expect(card.descriptionLines).toEqual(["Deal 3 Stun or 3 Bleed damage at random"]);
  });

  it("rejects a chance effect without a success outcome", () => {
    expect(() =>
      effectsCard({
        id: "bad",
        art: "bad",
        effects: [{ kind: "chance", probability: 0.5, successEffects: [], failureEffects: [] }],
      }),
    ).toThrow("Chance effect needs a success outcome");
  });
});

it("validates exact canonical text and still rejects edited amounts and omitted effects", () => {
  const card = effectsCard({
    id: "canonical",
    art: "",
    consume: true,
    effects: [
      { kind: "heal", amount: 4 },
      { kind: "draw-cards", amount: 1 },
    ],
  });
  expect(card.descriptionLines).toEqual(["Restore 4 Health", "Draw a card", "Consume"]);
  expect(canonicalCardDescriptionMatches(card)).toBe(true);
  expect(validateCardDescriptionParity(card)).toEqual([]);
  for (const descriptionLines of [
    ["Restore 9 Health", "Draw a card", "Consume"],
    ["Restore 4 Health", "Consume"],
  ]) {
    const changed = { ...card, descriptionLines };
    expect(canonicalCardDescriptionMatches(changed)).toBe(false);
    expect(validateCardDescriptionParity(changed).some((issue) => issue.severity === "error")).toBe(true);
  }
  expect(
    canonicalCardDescriptionMatches(
      effectsCard({
        id: "conditional",
        art: "",
        effects: [{ kind: "restore-mana", amount: 2, ifEnemyFrozen: true }],
      }),
    ),
  ).toBe(true);
});
