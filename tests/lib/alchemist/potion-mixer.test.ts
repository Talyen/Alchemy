import { makeTestCard } from "../../fixtures/cards";
import { describe, expect, it } from "vitest";
import { createMixedPotion, applyMixToDeck, doublePotionPotency } from "@/lib/alchemist";
import { cardLibrary, type BattleCard } from "@/lib/game-data";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { getStandardPotionPool } from "@/lib/game-data/cards/card-pools";
import { validateCardDescriptionParity } from "@/lib/content-validation/card-parity";
import { getCorruptionMutationGroups } from "@/lib/corruption/mutations";

function makePotion(overrides: Partial<BattleCard> = {}): BattleCard {
  return makeTestCard({
    id: "health-potion",
    title: "Health Potion",
    descriptionLines: ["Restore 5 Health", "Consume"],
    art: "health-potion",
    cost: 2,
    consume: true,
    effects: [{ kind: "heal", amount: 5 }],
    ...overrides,
  });
}

const healPotion = makePotion();

describe("createMixedPotion", () => {
  it("scales alternate Potion outcomes together with the primary magnitude", () => {
    const potion = makePotion({
      effects: [
        {
          kind: "damage",
          damageType: "physical",
          amount: 2,
          damageTypeIfTargetFrozen: "freeze",
          amountIfTargetFrozen: 8,
        },
        { kind: "player-status", status: "block", statusPool: ["block", "forge", "armor"], amount: 5, forgeAmount: 2 },
      ],
    });
    const expected = [
      { ...potion.effects[0], amount: 4, amountIfTargetFrozen: 16 },
      { ...potion.effects[1], amount: 10, forgeAmount: 4 },
    ];
    expect(createMixedPotion(potion, potion).effects).toEqual(expected);
    expect(doublePotionPotency(potion).effects).toEqual(expected);
    expect(potion.effects[0]).toMatchObject({ amount: 2, amountIfTargetFrozen: 8 });
  });
  it("scales every Luck Potion outcome and its description when mixing", () => {
    const luck = cardLibrary.find((card) => card.id === "luck-potion")!;
    const mixed = createMixedPotion(luck, luck);
    expect(mixed.effects).toEqual([
      {
        kind: "chance",
        probability: 0.5,
        successEffects: [{ kind: "restore-mana", amount: 8 }],
        failureEffects: [
          {
            kind: "chance",
            probability: 0.5,
            successEffects: [{ kind: "gain-gold", amount: 8 }],
            failureEffects: [{ kind: "player-status", status: "block", amount: 8 }],
          },
        ],
      },
    ]);
    expect(mixed.descriptionLines).toEqual(["Gain 8 Mana, Gold, or Block", "Consume"]);
    expect(luck.descriptionLines[0]).toBe("Gain 4 Mana, Gold, or Block");
  });
  it("preserves both ingredients even when different Potions have matching effects and prose", () => {
    const otherPotion = makePotion({ id: "another-health-potion" });
    const before = structuredClone([healPotion, otherPotion]);
    const mixed = createMixedPotion(healPotion, otherPotion);
    expect(mixed.effects).toEqual([
      { kind: "heal", amount: 5 },
      { kind: "heal", amount: 5 },
    ]);
    expect(mixed.descriptionLines).toEqual(["Restore 5 Health", "Restore 5 Health", "Consume"]);
    expect(mixed.consume).toBe(true);
    expect([healPotion, otherPotion]).toEqual(before);
  });
  it("keeps both effect sets when same-id cards differ below the top level", () => {
    const cardA = makePotion({
      effects: [
        { kind: "chance", probability: 0.5, successEffects: [{ kind: "heal", amount: 5 }], failureEffects: [] },
      ],
    });
    const cardB = makePotion({
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [{ kind: "heal", amount: 5 }],
          failureEffects: [{ kind: "gain-gold", amount: 3 }],
        },
      ],
    });
    const mixed = createMixedPotion(cardA, cardB);
    expect(mixed.effects).toHaveLength(2);
    expect(mixed.effects[1]).toEqual({
      kind: "chance",
      probability: 0.5,
      successEffects: [{ kind: "heal", amount: 5 }],
      failureEffects: [{ kind: "gain-gold", amount: 3 }],
    });
  });

  it("keeps a scheduled duration while scaling damage", () => {
    const turns = 2;
    const durationPotion = makePotion({
      id: "duration-potion",
      descriptionLines: [`Deal 10 Poison damage for the next ${turns} turns`, "Consume"],
      effects: [
        {
          kind: "repeat-over-turns",
          remainingTurns: turns,
          effects: [{ kind: "damage", damageType: "poison", amount: 10 }],
        },
      ],
    });
    const mixed = createMixedPotion(durationPotion, durationPotion);

    expect(mixed.effects[0]).toEqual({
      kind: "repeat-over-turns",
      remainingTurns: turns,
      effects: [{ kind: "damage", damageType: "poison", amount: 20 }],
    });
    expect(mixed.descriptionLines).toEqual([`Deal 20 Poison damage for the next ${turns} turns`, "Consume"]);
  });

  it("keeps an unscaled conversion rate when it matches a scaled damage amount", () => {
    const volatilePotion = makePotion({
      id: "volatile-potion",
      descriptionLines: ["Deal 5 Burn damage", "Convert each of your Mana into 5 Block", "Consume"],
      effects: [
        { kind: "damage", damageType: "burn", amount: 5 },
        { kind: "player-status", status: "block", amount: 0, convertCurrentMana: 5 },
      ],
    });

    const mixed = createMixedPotion(volatilePotion, volatilePotion);

    expect(mixed.effects[0]).toEqual({ kind: "damage", damageType: "burn", amount: 10 });
    expect(mixed.effects[1]).toEqual({ kind: "player-status", status: "block", amount: 0, convertCurrentMana: 5 });
    expect(mixed.descriptionLines).toEqual([
      "Deal 10 Burn damage",
      "Convert each of your Mana into 5 Block",
      "Consume",
    ]);
  });
});

describe("applyMixToDeck", () => {
  const potionA = makePotion({ id: "a" });
  const potionB = makePotion({ id: "b" });
  const potionC = makePotion({ id: "c" });
  const mixed = createMixedPotion(potionA, potionB);

  it("removes the two potions at given indices and appends the mixed potion", () => {
    const deck = [potionA, potionB, potionC];
    const original = [...deck];
    const result = applyMixToDeck(deck, 1, 0, mixed);
    expect(deck).toEqual(original);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("c");
    expect(result[1].id).toBe(mixed.id);
  });

  it("throws on identical indices or out-of-bounds indices", () => {
    const deck = [potionA, potionB, potionC];
    expect(() => applyMixToDeck(deck, 1, 1, mixed)).toThrow("Invalid potion indices for mixing");
    expect(() => applyMixToDeck(deck, -1, 1, mixed)).toThrow("Invalid potion indices for mixing");
    expect(() => applyMixToDeck(deck, 0, 5, mixed)).toThrow("Invalid potion indices for mixing");
    expect(() => applyMixToDeck(deck, 0.5, 1, mixed)).toThrow();
    expect(() => applyMixToDeck(deck, 0, Number.NaN, mixed)).toThrow();
  });
});

it.each(["mix", "double"] as const)(
  "Potion effect ownership %s owns nested mutable pools and metadata",
  (operation) => {
    const ingredient = makePotion({
      tags: ["archery"],
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [{ kind: "random-damage", minAmount: 1, maxAmount: 3, damageTypePool: ["burn", "holy"] }],
          failureEffects: [{ kind: "player-status", status: "block", amount: 1, statusPool: ["armor", "block"] }],
        },
      ],
    });
    const before = structuredClone(ingredient);
    const result = operation === "mix" ? createMixedPotion(ingredient, ingredient) : doublePotionPotency(ingredient);
    const chance = result.effects[0];
    if (chance.kind !== "chance") throw new Error("Expected chance Potion");
    const damage = chance.successEffects[0];
    const status = chance.failureEffects[0];
    if (damage.kind !== "random-damage" || status.kind !== "player-status") throw new Error("Expected pooled effects");
    expect(damage).toMatchObject({ minAmount: 2, maxAmount: 6 });
    damage.damageTypePool!.pop();
    status.statusPool!.pop();
    result.tags?.pop();
    expect(ingredient).toEqual(before);
  },
);

describe("mixed potion description parity", () => {
  it("keeps every standard Potion readable after Strong Spirits and mixing", () => {
    const pool = getStandardPotionPool();
    for (const potion of pool) {
      expect(validateCardDescriptionParity(doublePotionPotency(potion)), potion.id).toEqual([]);
      for (const ingredient of pool) {
        const mixed = createMixedPotion(potion, ingredient);
        expect(validateCardDescriptionParity(mixed), `${potion.id} + ${ingredient.id}`).toEqual([]);
      }
    }
  });

  it("keeps effects and text together when a corrupted Potion is mixed and restored", () => {
    const pool = getStandardPotionPool();
    for (const potion of pool) {
      const otherPotion = pool.find((candidate) => candidate.id !== potion.id)!;
      for (const group of getCorruptionMutationGroups(potion)) {
        for (const mutation of group.mutations) {
          const unscaledMix = createMixedPotion(mutation.card, otherPotion);
          const ingredientLines = mutation.card.descriptionLines.filter((line) => line !== "Consume");
          expect(unscaledMix.descriptionLines.slice(0, ingredientLines.length), `${potion.id}: ${group.kind}`).toEqual(
            ingredientLines,
          );
          const mixed = createMixedPotion(mutation.card, potion);
          expect(validateCardDescriptionParity(mixed), `${potion.id}: ${group.kind}`).toEqual([]);
          const restored = hydrateCard(JSON.parse(JSON.stringify(mixed)) as BattleCard);
          expect(restored.effects, `${potion.id}: ${group.kind}`).toEqual(mixed.effects);
          expect(restored.descriptionLines, `${potion.id}: ${group.kind}`).toEqual(mixed.descriptionLines);
        }
      }
    }
  });
});
