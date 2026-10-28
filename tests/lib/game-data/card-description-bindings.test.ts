import { createCleanup } from "@/lib/cleanup";
import { describe, expect, it, vi } from "vitest";
import {
  cardById,
  cloneBattleCard,
  cardMagnitude,
  carryCardDescriptionMarks,
  describeCardEffects,
  getCardDescription,
  renderCardDescription,
  withCardDescription,
} from "@/lib/game-data";
import { buildDescriptionMessage } from "@/lib/game-data/description-message";
import { getEditableCorruptionTargets, updateCardNumericValue } from "@/lib/corruption";
import { applyNumericCorruption } from "@/lib/corruption/numeric";
import { addCorruptionEffect } from "@/lib/corruption/card-edits";
import { BattleCardSchema } from "@/lib/validation/save-schemas/battle-card-schemas";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { createMixedPotion } from "@/lib/alchemist";
import { strengthenPotion } from "@/lib/alchemist/brewing";
import * as cardPools from "@/lib/game-data/cards/card-pools";
import { buildWishOptions } from "@/lib/battle/wish";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("card description bindings", () => {
  it("links equal even resource choices while keeping other odds and amounts independently editable", () => {
    for (const [probability, goldAmount, expectedLines, expectedAmounts] of [
      [0.5, 4, ["Gain 4 Mana or Gold"], [5, 5]],
      [0.25, 4, ["25% chance: Gain 4 Mana", "Otherwise: Gain 4 Gold"], [5, 4]],
      [0.5, 6, ["50% chance: Gain 4 Mana", "Otherwise: Gain 6 Gold"], [5, 6]],
    ] as const) {
      const raw = makeTestCard({
        effects: [
          {
            kind: "chance",
            probability,
            successEffects: [{ kind: "restore-mana", amount: 4 }],
            failureEffects: [{ kind: "gain-gold", amount: goldAmount }],
          },
        ],
      });
      const source = withCardDescription(raw, getCardDescription(raw));
      expect(source.descriptionLines).toEqual(expectedLines);
      const updated = applyNumericCorruption(source, getEditableCorruptionTargets(source)[0]!, 1);
      expect(updated.effects).toEqual([
        {
          kind: "chance",
          probability,
          successEffects: [{ kind: "restore-mana", amount: expectedAmounts[0] }],
          failureEffects: [{ kind: "gain-gold", amount: expectedAmounts[1] }],
        },
      ]);
      expect(source.descriptionLines).toEqual(expectedLines);
    }
  });

  it("allows repeated magnitude identities only when they bind the same ordered effect fields", () => {
    const effects = [
      { kind: "damage", damageType: "physical", amount: 3 },
      { kind: "damage", damageType: "physical", amount: 3 },
    ] as const;
    const first = cardMagnitude({ kind: "damage", effectIndex: 0, field: "amount" });
    const repeated = { ...first, references: first.references.map((reference) => ({ ...reference })) };
    const description = [{ role: "effect" as const, parts: [first, " then ", repeated] }];
    expect(renderCardDescription(effects, description).descriptionLines).toEqual(["3 then 3"]);
    repeated.references[0]!.effectIndex = 1;
    expect(() => renderCardDescription(effects, description)).toThrow(
      "Card magnitude identity references different effect fields",
    );
  });
  it("rejects numeric upgrades that would make a card unsaveable, including linked alternate values", () => {
    const source = withCardDescription(
      makeTestCard({
        effects: [
          {
            kind: "damage",
            damageType: "freeze",
            amount: 499,
            damageTypeIfTargetFrozen: "freeze",
            amountIfTargetFrozen: 998,
          },
        ],
      }),
      [
        {
          role: "effect",
          parts: [
            cardMagnitude(
              { kind: "damage", effectIndex: 0, field: "amount" },
              { shared: [{ kind: "damage", effectIndex: 0, field: "amountIfTargetFrozen", multiplier: 2 }] },
            ),
          ],
        },
      ],
    );
    const before = structuredClone(source);
    const target = getEditableCorruptionTargets(source)[0]!;
    for (const value of [-1, 1.5, 500, Infinity]) expect(updateCardNumericValue(source, target, value)).toBe(source);
    const updated = updateCardNumericValue(source, target, 498);
    expect(updated.effects).toEqual([{ ...source.effects[0], amount: 498, amountIfTargetFrozen: 996 }]);
    expect(BattleCardSchema.safeParse(updated).success).toBe(true);
    expect(source).toEqual(before);
    const ranged = makeTestCard({ effects: [{ kind: "random-damage", minAmount: 2, maxAmount: 4 }] });
    expect(updateCardNumericValue(ranged, getEditableCorruptionTargets(ranged)[0]!, 5)).toBe(ranged);
  });
  it("owns the bindings of an updated card so later edits cannot change the source card", () => {
    const source = cloneBattleCard(cardById["ray-of-frost"]!);
    const before = structuredClone(source);
    const updated = withCardDescription(source, getCardDescription(source));
    const magnitude = updated.description![0]!.parts.find((part) => typeof part !== "string")!;
    if (typeof magnitude === "string") throw new Error("Missing test magnitude");
    magnitude.references[0]!.effectIndex = 99;
    updated.description![0]!.parts.push("Changed");
    expect(source).toEqual(before);
  });

  it("keeps both Ray of Frost hits linked after wording changes, reload and another corruption", () => {
    const original = cardById["ray-of-frost"]!;
    const copy = cloneBattleCard(original);
    copy.description![0]!.parts = copy.description![0]!.parts.map((part) =>
      typeof part === "string" ? part.replace(" twice", " two times") : part,
    );
    const reworded = withCardDescription(copy, copy.description!);
    const first = applyNumericCorruption(reworded, getEditableCorruptionTargets(reworded)[0]!, 1);
    const raw = JSON.parse(JSON.stringify(first));
    // Saved display caches may be stale; effect bindings own the rendered content.
    raw.descriptionLines = [];
    raw.corruptedValuePositions = [{ lineIndex: 99, matchIndex: 99 }];
    const loaded = hydrateCard(BattleCardSchema.parse(raw));
    expect(loaded.descriptionLines).toEqual(["Deal 2 Freeze damage two times"]);
    expect(loaded).not.toHaveProperty("corruptedValuePositions");
    expect(getCardDescription(loaded)[0]!.parts).toContainEqual(expect.objectContaining({ corrupted: true }));

    const changed = applyNumericCorruption(loaded, getEditableCorruptionTargets(loaded)[0]!, 1);
    expect(changed.descriptionLines).toEqual(["Deal 3 Freeze damage two times"]);
    expect(changed.effects.map((effect) => ("amount" in effect ? effect.amount : null))).toEqual([3, 3]);

    expect(original.descriptionLines).toEqual(["Deal 1 Freeze damage twice"]);
    expect(original.effects.map((effect) => ("amount" in effect ? effect.amount : null))).toEqual([1, 1]);
  });

  it("binds reordered equal-valued custom clauses without treating other numbers as magnitudes", () => {
    const original = makeTestCard({
      effects: [
        { kind: "damage", damageType: "holy", amount: 1 },
        { kind: "gain-gold", amount: 1 },
      ],
    });
    const card = withCardDescription(original, [
      {
        role: "effect",
        parts: [
          "Collect ",
          cardMagnitude({ kind: "gain-gold", effectIndex: 1, field: "amount" }),
          " Gold, then hit 2 foes for ",
          cardMagnitude({ kind: "damage", effectIndex: 0, field: "amount" }),
          " Holy damage",
        ],
      },
    ]);
    const targets = getEditableCorruptionTargets(card);
    expect(targets.map((target) => target.effectIndex)).toEqual([1, 0]);
    const changed = updateCardNumericValue(card, targets[0]!, 2);
    expect(changed.effects).toEqual([original.effects[0], { kind: "gain-gold", amount: 2 }]);
    expect(changed.descriptionLines).toEqual(["Collect 2 Gold, then hit 2 foes for 1 Holy damage"]);
  });

  it("Powerful Wish upgrades repeated hits and skips shared Health costs after wording changes", () => {
    const card = withCardDescription(
      makeTestCard({
        effects: [
          { kind: "remove-harmful-status", amount: 1 },
          { kind: "damage", damageType: "burn", amount: 1 },
          { kind: "self-damage", damageType: "burn", amount: 1 },
        ],
      }),
      [
        {
          role: "effect",
          parts: [
            "Trade ",
            cardMagnitude(
              { kind: "damage", effectIndex: 1, field: "amount" },
              { shared: [{ kind: "self-damage", effectIndex: 2, field: "amount" }] },
            ),
            " Burn",
          ],
        },
      ],
    );
    expect(getEditableCorruptionTargets(card)[0]).toMatchObject({
      affectsCost: true,
      edits: [{ kind: "damage" }, { kind: "self-damage" }],
    });
    const ray = cloneBattleCard(cardById["ray-of-frost"]!);
    ray.description![0]!.parts = ray.description![0]!.parts.map((part) =>
      typeof part === "string" ? part.replace(" twice", " two times") : part,
    );
    const pool = vi
      .spyOn(cardPools, "getOfferableCardPoolView")
      .mockReturnValue([card, withCardDescription(ray, ray.description!)]);
    using _scopeCleanup = createCleanup(() => pool.mockRestore());

    const options = buildWishOptions(
      patchBattleState({ talentEffects: { wishCardsUpgraded: true }, rng: () => 0.99 }),
      cardById.wish!,
    );
    expect(options.find((choice) => choice.id === card.id)?.effects).toEqual(card.effects);
    expect(options.find((choice) => choice.id === ray.id)?.effects).toEqual([
      { kind: "damage", damageType: "freeze", amount: 2 },
      { kind: "damage", damageType: "freeze", amount: 2 },
    ]);
  });

  it("keeps mixed ingredient bindings and highlights independent after a new effect is prepended and reloaded", () => {
    const mixed = createMixedPotion(cardById["luck-potion"]!, cardById["mana-potion"]!);
    const originalTarget = getEditableCorruptionTargets(mixed)[0]!;
    const corrupted = applyNumericCorruption(mixed, originalTarget, 1);
    const paid = addCorruptionEffect(corrupted, { kind: "lose-health", amount: 2 }, "first");
    const loaded = hydrateCard(BattleCardSchema.parse(JSON.parse(JSON.stringify(paid))));
    const target = getEditableCorruptionTargets(loaded).find(
      (entry) => entry.field === "amount" && entry.effectIndex === 1,
    )!;
    const changed = updateCardNumericValue(loaded, target, target.value + 1);
    expect(changed.effects[0]).toEqual({ kind: "lose-health", amount: 2 });
    expect(changed.effects[2]).toEqual(mixed.effects[1]);
    expect(changed.descriptionLines).toEqual([
      "Lose 2 Health",
      "50% chance: Gain 6 Mana",
      "Otherwise: Gain 4 Gold or Block",
      "Gain 2 Mana",
      "Consume",
    ]);
  });

  it("drops malformed saved bindings while retaining the card's actual effects", () => {
    const card = cloneBattleCard(cardById["ray-of-frost"]!);
    const magnitude = getCardDescription(card)[0]!.parts.find((part) => typeof part !== "string")!;
    if (typeof magnitude === "string") throw new Error("Missing test magnitude");
    magnitude.references[1]!.effectIndex = 99;
    const loaded = hydrateCard(BattleCardSchema.parse(JSON.parse(JSON.stringify(card))));
    expect(loaded.description).toBeUndefined();
    expect(loaded.effects).toEqual(card.effects);
    const upgraded = updateCardNumericValue(loaded, getEditableCorruptionTargets(loaded)[0]!, 2);
    expect(upgraded.effects.map((effect) => ("amount" in effect ? effect.amount : null))).toEqual([2, 2]);
  });

  it("rebuilds missing Companion bindings without making its summon summary upgradeable", () => {
    const card = addCorruptionEffect(cardById["wolf-companion"]!, { kind: "damage", damageType: "poison", amount: 1 });
    const { description: _description, ...unbound } = card;
    const loaded = hydrateCard(BattleCardSchema.parse(JSON.parse(JSON.stringify(unbound))));
    const targets = getEditableCorruptionTargets(loaded);
    expect(targets).toHaveLength(1);
    const changed = updateCardNumericValue(loaded, targets[0]!, 2);
    expect(changed.effects[0]).toEqual(card.effects[0]);
    expect(changed.effects[1]).toEqual({ kind: "damage", damageType: "poison", amount: 2 });
    expect(changed.descriptionLines[0]).toBe(card.descriptionLines[0]);
  });

  it("rejects a captured target after an equal-valued hit is inserted at its old address", () => {
    const original = cardById.slash!;
    const target = getEditableCorruptionTargets(original)[0]!;
    const changed = addCorruptionEffect(
      original,
      { kind: "damage", damageType: "physical", amount: target.value },
      "first",
    );
    expect(updateCardNumericValue(changed, target, target.value + 1)).toBe(changed);
    const refreshed = getEditableCorruptionTargets(changed).find((entry) => entry.id === target.id)!;
    expect(refreshed.effectIndex).toBe(1);
    const upgraded = updateCardNumericValue(changed, refreshed, refreshed.value + 1);
    expect(upgraded.effects[0]).toEqual(changed.effects[0]);
    expect(upgraded.effects[1]).toMatchObject({ amount: target.value + 1 });
  });

  it("retains corrupted quantity identities and highlights when a Potion is strengthened and reloaded", () => {
    const potion = cardById["health-potion"]!;
    const target = getEditableCorruptionTargets(potion)[0]!;
    const corrupted = applyNumericCorruption(potion, target, 1);
    const strengthened = strengthenPotion(corrupted)!;
    const loaded = hydrateCard(BattleCardSchema.parse(JSON.parse(JSON.stringify(strengthened))));
    expect(loaded.effects[0]).toEqual({ kind: "heal", amount: 10 });
    expect(getCardDescription(loaded)[0]!.parts).toContainEqual(
      expect.objectContaining({ corrupted: true, distilled: true }),
    );
    expect(loaded.descriptionLines).toEqual(["Restore 10 Health", "Consume"]);

    expect(getEditableCorruptionTargets(loaded)[0]!.id).toBe(target.id);
  });
});

it.each([
  { effectPath: undefined, expected: "3:amount" },
  { effectPath: [], expected: "3:amount" },
  { effectPath: [0, 2], expected: "3/0/2:amount" },
])("preserves magnitude addresses for path $effectPath", ({ effectPath, expected }) => {
  const reference = { kind: "heal" as const, effectIndex: 3, field: "amount" as const, effectPath };
  const magnitude = cardMagnitude(reference);
  expect(magnitude.id).toBe(expected);
  expect(magnitude.references).toEqual([reference]);
});

it("carries both marks and identity across a shared magnitude split without mutating its source", () => {
  const first = { kind: "heal" as const, effectIndex: 0, field: "amount" as const };
  const second = { ...first, effectIndex: 1 };
  const marked = cardMagnitude(first, { shared: [second], corrupted: true, distilled: true });
  const previous = [{ role: "effect" as const, parts: [marked] }];
  const before = structuredClone(previous);
  const result = carryCardDescriptionMarks(previous, [
    { role: "effect", parts: [cardMagnitude(first), " and ", cardMagnitude(second)] },
  ]);
  expect(result[0]!.parts[0]).toMatchObject({ id: "0:amount", corrupted: true, distilled: true });
  expect(result[0]!.parts[2]).toMatchObject({ id: "1:amount", corrupted: true, distilled: true });
  expect(previous).toEqual(before);
});

it("keeps localization slot order, decimal values, and numeric tag names intact", () => {
  const message = buildDescriptionMessage([
    { text: "Restore " },
    { text: "12", magnitudeId: "0:amount" },
    { text: " Health; <note7>2.5 extra</note7>." },
  ]);
  expect(message.template).toBe(
    "Restore <magnitude0>{{value0}}</magnitude0> <keyword0>Health</keyword0>; <note7>{{value1}} extra</note7>.",
  );
  expect(message.slots).toEqual({ magnitude0: { magnitudeId: "0:amount" }, keyword0: { keywordId: "health" } });
  expect(message.values).toEqual({ value0: 12, value1: 2.5 });
  expect(buildDescriptionMessage([])).toMatchObject({ template: "", slots: {}, values: {} });
});

it.each([
  [true, false, "Ignores Armor"],
  [false, true, "Ignores Block"],
  [true, true, "Ignores Armor and Block"],
] as const)("retains exact bypass wording for Armor %s and Block %s", (ignoreArmor, ignoreBlock, expected) => {
  expect(
    describeCardEffects([{ kind: "damage", damageType: "physical", amount: 2, ignoreArmor, ignoreBlock }]),
  ).toEqual(["Deal 2 Physical damage", expected]);
});
