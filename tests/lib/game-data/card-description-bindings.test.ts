import { describe, expect, it, vi } from "vitest";
import { cardById, cloneBattleCard, cardMagnitude, getCardDescription, withCardDescription } from "@/lib/game-data";
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
  it("keeps both Ray of Frost hits linked after wording changes, reload and another corruption", () => {
    const original = cardById["ray-of-frost"]!;
    const copy = cloneBattleCard(original);
    copy.description![0]!.parts = copy.description![0]!.parts.map((part) =>
      typeof part === "string" ? part.replace(" twice", " two times") : part,
    );
    const reworded = withCardDescription(copy, copy.description!);
    const first = applyNumericCorruption(reworded, getEditableCorruptionTargets(reworded)[0]!, 1);
    const raw = JSON.parse(JSON.stringify(first));
    // Derived strings and offsets may be stale; the persisted bindings own both.
    raw.descriptionLines = [];
    raw.corruptedValuePositions = [{ lineIndex: 99, matchIndex: 99 }];
    const loaded = hydrateCard(BattleCardSchema.parse(raw));
    expect(loaded.descriptionLines).toEqual(["Deal 2 Freeze damage two times"]);
    expect(loaded.corruptedValuePositions).toEqual([{ lineIndex: 0, matchIndex: 5 }]);
    const changed = applyNumericCorruption(loaded, getEditableCorruptionTargets(loaded)[0]!, 1);
    expect(changed.descriptionLines).toEqual(["Deal 3 Freeze damage two times"]);
    expect(changed.effects.map((effect) => ("amount" in effect ? effect.amount : null))).toEqual([3, 3]);
    expect(changed.corruptedValuePositions).toEqual([{ lineIndex: 0, matchIndex: 5 }]);
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
    const card = withCardDescription(cardById.cauterize!, [
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
    ]);
    expect(getEditableCorruptionTargets(card)[0]).toMatchObject({
      affectsCost: true,
      edits: [{ kind: "damage" }, { kind: "self-damage" }],
    });
    const ray = cloneBattleCard(cardById["ray-of-frost"]!);
    ray.description![0]!.parts = ray.description![0]!.parts.map((part) =>
      typeof part === "string" ? part.replace(" twice", " two times") : part,
    );
    const pool = vi
      .spyOn(cardPools, "getOfferableCardPool")
      .mockReturnValue([card, withCardDescription(ray, ray.description!)]);
    try {
      const options = buildWishOptions(
        patchBattleState({ talentEffects: { wishCardsUpgraded: true }, rng: () => 0.99 }),
        cardById.wish!,
      );
      expect(options.find((choice) => choice.id === card.id)?.effects).toEqual(card.effects);
      expect(options.find((choice) => choice.id === ray.id)?.effects).toEqual([
        { kind: "damage", damageType: "freeze", amount: 2 },
        { kind: "damage", damageType: "freeze", amount: 2 },
      ]);
    } finally {
      pool.mockRestore();
    }
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
      "Gain 6 Mana, Gold, or Block",
      "Gain 2 Mana",
      "Consume",
    ]);
    expect(changed.corruptedValuePositions).toEqual([
      { lineIndex: 0, matchIndex: 5 },
      { lineIndex: 1, matchIndex: 5 },
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
    expect(loaded.descriptionLines).toEqual(["Restore 10 Health", "Consume"]);
    expect(loaded.corruptedValuePositions).toEqual([{ lineIndex: 0, matchIndex: 8 }]);
    expect(getEditableCorruptionTargets(loaded)[0]!.id).toBe(target.id);
  });
});
