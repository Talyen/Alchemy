import { expect, it } from "vitest";
import { createMixedPotion, doublePotionPotency } from "@/lib/alchemist";
import { cardById, cloneBattleCard, getCardDescription, type BattleCardEffect } from "@/lib/game-data";
import { getStandardPotionPool } from "@/lib/game-data/cards/card-pools";
import { validateCardDescriptionParity } from "@/lib/content-validation/card-parity";
import { getCorruptionMutationGroups } from "@/lib/corruption/mutations";
import { chance, potion, repeated, roundTrip } from "./fixtures";

it("carries both ingredients' improvement marks and tags through folding and restoration", () => {
  const first = potion([{ kind: "heal", amount: 5 }], { tags: ["archery"] });
  const second = cloneBattleCard(first);
  for (const [ingredient, mark] of [
    [first, "distilled"],
    [second, "corrupted"],
  ] as const)
    for (const part of getCardDescription(ingredient).flatMap((line) => line.parts))
      if (typeof part !== "string") part[mark] = true;
  for (const ingredients of [
    [first, second],
    [second, first],
  ] as const) {
    const mixed = createMixedPotion(...ingredients);
    expect(mixed.effects).toEqual([{ kind: "heal", amount: 10 }]);
    expect(mixed.descriptionLines).toEqual(["Restore 10 Health", "Archery", "Consume"]);
    expect(getCardDescription(mixed)[0]!.parts).toContainEqual(
      expect.objectContaining({ distilled: true, corrupted: true }),
    );
    expect(roundTrip(mixed)).toEqual(mixed);
  }
});

it("scales alternate magnitudes and delayed effects without extending their duration", () => {
  const effects: BattleCardEffect[] = [
    { kind: "damage", damageType: "physical", amount: 2, damageTypeIfTargetFrozen: "freeze", amountIfTargetFrozen: 8 },
    { kind: "player-status", status: "block", statusPool: ["block", "forge", "armor"], amount: 5, forgeAmount: 2 },
    repeated([{ kind: "damage", damageType: "poison", amount: 10 }]),
  ];
  const source = potion(effects);
  const before = structuredClone(source);
  const expected = [
    { ...effects[0], amount: 4, amountIfTargetFrozen: 16 },
    { ...effects[1], amount: 10, forgeAmount: 4 },
    repeated([{ kind: "damage", damageType: "poison", amount: 20 }]),
  ];
  expect(createMixedPotion(source, source).effects).toEqual(expected);
  expect(doublePotionPotency(source).effects).toEqual(expected);
  expect(source).toEqual(before);
});

it("scales every nested Luck outcome without changing its probabilities", () => {
  const luck = cardById["luck-potion"]!;
  const mixed = createMixedPotion(luck, luck);
  expect(mixed.effects).toEqual([
    chance(
      [{ kind: "restore-mana", amount: 8 }],
      [chance([{ kind: "gain-gold", amount: 8 }], [{ kind: "player-status", status: "block", amount: 8 }])],
    ),
  ]);
  expect(mixed.descriptionLines).toEqual(["Gain 8 Mana, Gold, or Block", "Consume"]);
});

it("keeps distinct ingredients and same-ID ingredients with different nested outcomes separate", () => {
  const first = potion([chance([{ kind: "heal", amount: 5 }], [])]);
  const different = potion([chance([{ kind: "heal", amount: 5 }], [{ kind: "gain-gold", amount: 3 }])]);
  const otherType = { ...first, id: "another-potion" };
  for (const other of [different, otherType])
    expect(createMixedPotion(first, other).effects).toEqual([...first.effects, ...other.effects]);
});

it.each<BattleCardEffect>([
  { kind: "remove-enemy-armor", halve: true },
  { kind: "lose-health", amount: 2 },
  { kind: "self-damage", damageType: "burn", amount: 2 },
  { kind: "lose-mana", amount: 1 },
  { kind: "lose-max-mana", amount: 1 },
  { kind: "player-status", status: "haste", amount: 1 },
  { kind: "player-status", status: "phoenixFeather", amount: 1 },
  { kind: "player-status", status: "block", amount: 0, convertCurrentMana: 5 },
  { kind: "player-status", status: "block", amount: 0, perManaCrystal: 2 },
  { kind: "damage", damageType: "holy", amount: 0, equalToBlock: true },
  { kind: "damage", damageType: "holy", amount: 0, equalToArmor: true },
  { kind: "multiply-enemy-status", status: "burn", factor: 2 },
  { kind: "damage", damageType: "burn", amount: 0, forgeBonusPercent: 50 },
])("preserves both executions of %j when potency cannot represent them", (effect) => {
  const source = potion([repeated([effect]), { kind: "heal", amount: 8 }]);
  expect(createMixedPotion(source, source).effects).toEqual([...source.effects, ...source.effects]);
  if (effect.kind !== "remove-enemy-armor")
    expect(doublePotionPotency(source).effects).toEqual([repeated([effect]), { kind: "heal", amount: 16 }]);
});

it("bounds crafted identities across repeated mixes instead of embedding the entire recipe", () => {
  let mixed = cardById["health-potion"]!;
  for (let i = 0; i < 20; i++) mixed = createMixedPotion(mixed, cardById["mana-potion"]!);
  expect(mixed.id).toBe("mixed-potion-crafted");
  expect(roundTrip(mixed)).toEqual(mixed);
});

it.each([createMixedPotion, (card: ReturnType<typeof potion>) => doublePotionPotency(card)])(
  "owns mutable ingredient pools",
  (transform) => {
    const source = potion(
      [
        chance(
          [{ kind: "random-damage", minAmount: 1, maxAmount: 3, damageTypePool: ["burn", "holy"] }],
          [{ kind: "player-status", status: "block", amount: 1, statusPool: ["armor", "block"] }],
        ),
      ],
      { tags: ["archery"] },
    );
    const before = structuredClone(source);
    const result = transform(source, source);
    const wrapper = result.effects[0] as Extract<BattleCardEffect, { kind: "chance" }>;
    const damage = wrapper.successEffects[0] as Extract<BattleCardEffect, { kind: "random-damage" }>;
    expect(damage).toMatchObject({ minAmount: 2, maxAmount: 6 });
    damage.damageTypePool!.pop();
    Object.assign(wrapper.failureEffects[0]!, { statusPool: [] });
    result.tags!.pop();
    expect(source).toEqual(before);
  },
);

it("keeps standard and corrupted Potion descriptions faithful through mixing and restoration", () => {
  const pool = getStandardPotionPool();
  const failures: string[] = [];
  for (const source of pool) {
    if (validateCardDescriptionParity(doublePotionPotency(source)).length)
      failures.push(`${source.id}: Strong Spirits`);
    for (const other of pool)
      if (validateCardDescriptionParity(createMixedPotion(source, other)).length)
        failures.push(`${source.id} + ${other.id}`);
    for (const group of getCorruptionMutationGroups(source)) {
      for (const mutation of group.mutations) {
        const mixed = createMixedPotion(mutation.card, source);
        if (validateCardDescriptionParity(mixed).length) failures.push(`${source.id}: ${group.kind}`);
        expect(roundTrip(mixed)).toEqual(mixed);
        const other = pool.find((candidate) => candidate.id !== source.id)!;
        const lines = mutation.card.descriptionLines.filter((line) => line !== "Consume");
        expect(createMixedPotion(mutation.card, other).descriptionLines.slice(0, lines.length)).toEqual(lines);
      }
    }
  }
  expect(failures).toEqual([]);
});
