import { describe, expect, it } from "vitest";
import { cardById, characters, getCardKeywords } from "@/lib/game-data";
import { createCampfirePotionOffers, strengthenPotion } from "@/lib/alchemist/brewing";
import { createTransmutationOffers } from "@/lib/alchemist/transmutation";
import { tryCreateMixedPotion } from "@/lib/alchemist";
import { makeTestCard } from "../../fixtures/cards";
import { BattleCardSchema } from "@/lib/validation/save-schemas/battle-card-schemas";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { createSeededRng } from "@/lib/rng";
describe("brewing and transmutation content", () => {
  it("creates distinct fixed Potion offers with a recovery or defense option", () => {
    const offers = createCampfirePotionOffers(createSeededRng(23));
    expect(new Set(offers.map((card) => card.id)).size).toBe(3);
    expect(offers.some((card) => ["health-potion", "stoneskin-potion", "panacea-potion"].includes(card.id))).toBe(true);
    expect(offers).toEqual(createCampfirePotionOffers(createSeededRng(23)));
  });
  it("allows repeated strengthening and mixing after save hydration", () => {
    const potion = strengthenPotion(cardById["health-potion"]!)!;
    expect(potion.descriptionLines).toEqual(["Restore 9 Health", "Consume"]);
    expect(potion.cost).toBe(cardById["health-potion"]!.cost);
    const restored = hydrateCard(BattleCardSchema.parse({ ...potion, brewed: true }));
    expect(restored.effects).toEqual(potion.effects);
    const again = strengthenPotion(restored)!;
    expect(again.effects).toEqual([{ kind: "heal", amount: 10 }]);
    const mixed = tryCreateMixedPotion(again, cardById["mana-potion"])!;
    expect(mixed.effects).toEqual([
      { kind: "heal", amount: 10 },
      { kind: "restore-mana", amount: 2 },
    ]);
    expect(strengthenPotion(mixed)?.effects).toEqual([
      { kind: "heal", amount: 11 },
      { kind: "restore-mana", amount: 3 },
    ]);
    expect(tryCreateMixedPotion(mixed, restored)?.effects).toEqual([...mixed.effects, ...restored.effects]);
    expect(strengthenPotion(cardById["panacea-potion"]!)?.effects).toEqual([
      { kind: "remove-harmful-status", removeAll: true },
      { kind: "heal", amount: 1 },
    ]);
    expect(strengthenPotion(strengthenPotion(cardById["panacea-potion"]!)!)?.effects).toEqual([
      { kind: "remove-harmful-status", removeAll: true },
      { kind: "heal", amount: 2 },
    ]);
    expect(strengthenPotion(cardById["wishing-potion"]!)?.effects).toEqual([
      { kind: "wish", amount: 2 },
      { kind: "draw-cards", amount: 1 },
    ]);
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
        successEffects: [{ kind: "restore-mana", amount: 5 }],
        failureEffects: [
          {
            kind: "chance",
            probability: 0.5,
            successEffects: [{ kind: "gain-gold", amount: 5 }],
            failureEffects: [{ kind: "player-status", status: "block", amount: 5 }],
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
            successEffects: [{ kind: "heal", amount: 6 }],
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
  it("offers each class affinity with distinct matching candidates and independent hydrated cards", () => {
    for (const character of Object.values(characters)) {
      const choices = createTransmutationOffers(character.id, createSeededRng(42));
      expect(choices).toEqual(createTransmutationOffers(character.id, createSeededRng(42)));
      expect(choices).toHaveLength(3);
      if (character.keywords.length) expect(choices.map((choice) => choice.keyword)).toEqual(character.keywords);
      expect(new Set(choices.map((choice) => choice.keyword)).size).toBe(3);
      for (const { keyword, candidates } of choices) {
        expect(candidates).toHaveLength(4);
        expect(new Set(candidates.map((card) => card.id)).size).toBe(4);
        expect(candidates.every((card) => getCardKeywords(card).includes(keyword))).toBe(true);
        expect(candidates.map((card) => hydrateCard(BattleCardSchema.parse(card)))).toEqual(candidates);
      }
      const candidate = choices[0]!.candidates[0]!;
      const catalogCard = cardById[candidate.id]!;
      const before = structuredClone(catalogCard);
      Object.assign(candidate.effects[0], { amount: 999 });
      expect(catalogCard).toEqual(before);
    }
  });
});
