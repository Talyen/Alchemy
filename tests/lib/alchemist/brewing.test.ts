import { describe, expect, it } from "vitest";
import { cardById } from "@/lib/game-data";
import { createCampfirePotionOffers, strengthenPotion } from "@/lib/alchemist/brewing";
import { createTransmutationOffers } from "@/lib/alchemist/transmutation";
import { tryCreateMixedPotion } from "@/lib/alchemist";
import { makeTestCard } from "../../fixtures/cards";
import { BattleCardSchema } from "@/lib/validation/save-schemas/battle-card-schemas";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { createSeededRng } from "@/lib/rng";
import { getBattleCardTransmutationRole } from "@/lib/battle/card-classification";
describe("brewing and transmutation content", () => {
  it("creates distinct fixed Potion offers with a recovery or defense option", () => {
    const offers = createCampfirePotionOffers(createSeededRng(23));
    expect(new Set(offers.map((card) => card.id)).size).toBe(3);
    expect(offers.some((card) => ["health-potion", "stoneskin-potion", "panacea-potion"].includes(card.id))).toBe(true);
    expect(offers).toEqual(createCampfirePotionOffers(createSeededRng(23)));
  });
  it("strengthens numerical effects once and preserves the result through save hydration", () => {
    const potion = strengthenPotion(cardById["health-potion"]!)!;
    expect(potion.descriptionLines).toEqual(["Restore 12 Health", "Consume"]);
    expect(potion.cost).toBe(cardById["health-potion"]!.cost);
    const restored = hydrateCard(BattleCardSchema.parse(potion));
    expect(restored.effects).toEqual(potion.effects);
    expect(restored.brewed).toBe(true);
    expect(strengthenPotion(restored)).toBeNull();
    expect(tryCreateMixedPotion(restored, cardById["mana-potion"])).toBeNull();
    expect(strengthenPotion(cardById["panacea-potion"]!)).toBeNull();
    expect(strengthenPotion(cardById["wishing-potion"]!)).toBeNull();
  });
  it("preserves nested chance probabilities and nonnumeric Acid effects", () => {
    const acid = strengthenPotion(cardById["acid-potion"]!)!;
    expect(acid.effects).toEqual([
      { kind: "remove-enemy-armor", halve: true },
      { kind: "damage", damageType: "poison", amount: 3 },
    ]);
    const luck = strengthenPotion(cardById["luck-potion"]!)!;
    expect(luck.effects).toEqual([
      {
        kind: "chance",
        probability: 0.5,
        successEffects: [{ kind: "restore-mana", amount: 6 }],
        failureEffects: [
          {
            kind: "chance",
            probability: 0.5,
            successEffects: [{ kind: "gain-gold", amount: 6 }],
            failureEffects: [{ kind: "player-status", status: "block", amount: 6 }],
          },
        ],
      },
    ]);
  });
  it("strengthens nested magnitudes without scaling status durations or conversion factors", () => {
    const protectedEffects = [
      { kind: "player-status" as const, status: "haste" as const, amount: 1 },
      { kind: "player-status" as const, status: "block" as const, amount: 2, convertCurrentMana: 3 },
      { kind: "damage" as const, damageType: "holy" as const, amount: 50, equalToGoldPercent: 50 },
    ];
    const card = makeTestCard({
      id: "health-potion",
      effects: [
        {
          kind: "repeat-over-turns",
          remainingTurns: 2,
          effects: [
            {
              kind: "chance",
              probability: 0.25,
              successEffects: [{ kind: "heal", amount: 5 }],
              failureEffects: protectedEffects,
            },
          ],
        },
      ],
    });
    const before = structuredClone(card);
    const strengthened = strengthenPotion(card)!;
    expect(strengthened.effects).toEqual([
      {
        kind: "repeat-over-turns",
        remainingTurns: 2,
        effects: [
          {
            kind: "chance",
            probability: 0.25,
            successEffects: [{ kind: "heal", amount: 8 }],
            failureEffects: protectedEffects,
          },
        ],
      },
    ]);
    expect(card).toEqual(before);
    const wrapper = strengthened.effects[0];
    if (wrapper.kind !== "repeat-over-turns") throw new Error("Expected scheduled Potion");
    const chance = wrapper.effects[0];
    if (chance.kind !== "chance") throw new Error("Expected chance Potion");
    Object.assign(chance.failureEffects[0], { amount: 99 });
    expect(card).toEqual(before);
  });
  it("offers distinct attack, defense and utility cards that survive save hydration", () => {
    for (const seed of [10, 25, 42, 51, 99, 1337]) {
      const offers = createTransmutationOffers(createSeededRng(seed));
      expect(offers.map((card) => card.transmutationRole ?? getBattleCardTransmutationRole(card))).toEqual([
        "attack",
        "defense",
        "utility",
      ]);
      expect(new Set(offers.map((card) => card.id)).size).toBe(3);
      expect(offers.map((card) => hydrateCard(BattleCardSchema.parse(card)))).toEqual(offers);
    }
  });
});
