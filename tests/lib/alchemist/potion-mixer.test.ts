import { describe, expect, it } from "vitest";
import { createMixedPotion, tryCreateMixedPotion, applyMixToDeck, doublePotionPotency } from "@/lib/alchemist";
import { cardLibrary, type BattleCard } from "@/lib/game-data";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { getStandardPotionPool } from "@/lib/game-data/cards/card-pools";
import { validateCardDescriptionParity } from "@/lib/content-validation/card-parity";
import { getCorruptionMutationGroups } from "@/lib/corruption/mutations";

function makePotion(overrides: Partial<BattleCard> = {}): BattleCard {
  return {
    id: "health-potion",
    title: "Health Potion",
    descriptionLines: ["Restore 5 Health", "Consume"],
    art: "health-potion",
    cost: 2,
    consume: true,
    effects: [{ kind: "heal", amount: 5 }],
    ...overrides,
  };
}

const healPotion = makePotion();
const firePotion = makePotion({
  id: "fire-potion",
  title: "Fire Potion",
  descriptionLines: ["Deal 8 Burn damage", "Consume"],
  effects: [{ kind: "damage", damageType: "burn", amount: 8 }],
});

describe("createMixedPotion", () => {
  it("scales every Luck Potion outcome and its description when mixing", () => {
    const luck = cardLibrary.find((card) => card.id === "luck-potion")!;
    const mixed = createMixedPotion(luck, luck, 2);
    expect(mixed.effects).toEqual([
      {
        kind: "chance",
        probability: 0.5,
        successEffects: [{ kind: "restore-mana", amount: 10 }],
        failureEffects: [
          {
            kind: "chance",
            probability: 0.5,
            successEffects: [{ kind: "gain-gold", amount: 10 }],
            failureEffects: [{ kind: "player-status", status: "block", amount: 10 }],
          },
        ],
      },
    ]);
    expect(mixed.descriptionLines).toEqual(["Gain 10 Mana, Gold, or Block", "Consume"]);
    expect(luck.descriptionLines[0]).toBe("Gain 4 Mana, Gold, or Block");
  });
  it("combines different Potions with potency bonuses while preserving both ingredients", () => {
    const before = structuredClone([healPotion, firePotion]);
    const mixed = createMixedPotion(healPotion, firePotion, 2);
    expect(mixed.effects).toEqual([
      { kind: "heal", amount: 7 },
      { kind: "damage", damageType: "burn", amount: 10 },
    ]);
    expect(mixed.descriptionLines).toEqual(["Restore 7 Health", "Deal 10 Burn damage", "Consume"]);
    expect(mixed.consume).toBe(true);
    expect([healPotion, firePotion]).toEqual(before);
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

  it("preserves repeated description lines from different cards to match concatenated effects", () => {
    const manaPotionA = makePotion({
      id: "mana-potion-a",
      descriptionLines: ["Gain 2 Mana", "Consume"],
      effects: [{ kind: "restore-mana", amount: 2 }],
    });
    const manaPotionB = makePotion({
      id: "mana-potion-b",
      descriptionLines: ["Gain 2 Mana", "Consume"],
      effects: [{ kind: "restore-mana", amount: 2 }],
    });
    const mixed = createMixedPotion(manaPotionA, manaPotionB);

    expect(mixed.effects).toHaveLength(2);
    expect(mixed.descriptionLines).toEqual(["Gain 2 Mana", "Gain 2 Mana", "Consume"]);
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
    const mixed = createMixedPotion(durationPotion, durationPotion, 3);

    expect(mixed.effects[0]).toEqual({
      kind: "repeat-over-turns",
      remainingTurns: turns,
      effects: [{ kind: "damage", damageType: "poison", amount: 23 }],
    });
    expect(mixed.descriptionLines).toEqual([`Deal 23 Poison damage for the next ${turns} turns`, "Consume"]);
  });

  it("does not cascade-replace numbers when a scaled amount matches another base effect amount", () => {
    const multiEffectPotion = makePotion({
      id: "hybrid-potion",
      descriptionLines: ["Deal 5 Burn damage", "Gain 10 Block", "Consume"],
      effects: [
        { kind: "damage", damageType: "burn", amount: 5 },
        { kind: "player-status", status: "block", amount: 10 },
      ],
    });

    const mixed = createMixedPotion(multiEffectPotion, multiEffectPotion);

    expect(mixed.effects[0]).toEqual({ kind: "damage", damageType: "burn", amount: 10 });
    expect(mixed.effects[1]).toEqual({ kind: "player-status", status: "block", amount: 20 });
    expect(mixed.descriptionLines).toEqual(["Deal 10 Burn damage", "Gain 20 Block", "Consume"]);
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

  it("produces a unique id based on card uids", () => {
    const p1 = makePotion({ id: "heal-potion", uid: 1 });
    const p2 = makePotion({ id: "fire-potion", uid: 2 });
    const p3 = makePotion({ id: "fire-potion", uid: 3 });
    const a = createMixedPotion(p1, p2);
    const b = createMixedPotion(p1, p3);
    expect(a.id).not.toBe(b.id);
  });
});

describe("tryCreateMixedPotion", () => {
  it("returns null if either input is undefined", () => {
    expect(tryCreateMixedPotion(undefined, healPotion)).toBeNull();
    expect(tryCreateMixedPotion(healPotion, undefined)).toBeNull();
    expect(tryCreateMixedPotion(undefined, undefined)).toBeNull();
  });

  it("uses the same eligibility for throwing and nullable callers, including strengthened Potions", () => {
    for (const invalid of [makePotion({ brewed: true }), makePotion({ id: "mixed-potion" })]) {
      expect(tryCreateMixedPotion(invalid, healPotion)).toBeNull();
      expect(tryCreateMixedPotion(healPotion, invalid)).toBeNull();
      expect(() => createMixedPotion(invalid, healPotion)).toThrow("Cannot mix");
      expect(() => createMixedPotion(healPotion, invalid)).toThrow("Cannot mix");
    }
    expect(tryCreateMixedPotion(healPotion, firePotion)).toEqual(createMixedPotion(healPotion, firePotion));
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

describe("Potion effect ownership", () => {
  it.each(["mix", "double"] as const)("%s owns nested mutable pools and metadata", (operation) => {
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
  });
});

describe("mixed potion description parity", () => {
  it("keeps every standard Potion readable after Strong Spirits and mixing", () => {
    const pool = getStandardPotionPool();
    for (const potion of pool) {
      expect(validateCardDescriptionParity(doublePotionPotency(potion)), potion.id).toEqual([]);
      for (const ingredient of pool) {
        const mixed = createMixedPotion(potion, ingredient, 2);
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
          const mixed = createMixedPotion(mutation.card, potion, 1);
          expect(validateCardDescriptionParity(mixed), `${potion.id}: ${group.kind}`).toEqual([]);
          const restored = hydrateCard(JSON.parse(JSON.stringify(mixed)) as BattleCard);
          expect(restored.effects, `${potion.id}: ${group.kind}`).toEqual(mixed.effects);
          expect(restored.descriptionLines, `${potion.id}: ${group.kind}`).toEqual(mixed.descriptionLines);
        }
      }
    }
  });
});
