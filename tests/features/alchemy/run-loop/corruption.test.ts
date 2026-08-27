import { describe, expect, it } from "vitest";
import {
  corruptCard,
  corruptDeckCard,
  getEditableCorruptionTargets,
  isSpecialCorruptionCard,
  replaceNumberAt,
} from "@/lib/corruption";
import { makeTestCard } from "../../../fixtures/cards";
import { makeEffect } from "../../../fixtures/battle";
import type { BattleCard } from "@/lib/game-data";

function makeRng(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values[values.length - 1] ?? 0.99;
}

function makeCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return makeTestCard({
    id: "slash",
    title: "Slash",
    descriptionLines: ["Deal 5 Physical damage"],
    art: "slash-art",
    effects: [makeEffect("physical", 5)],
    ...overrides,
  });
}

describe("card corruption", () => {
  it("finds editable numeric description targets with matching effects", () => {
    const targets = getEditableCorruptionTargets(makeCard());

    expect(targets).toHaveLength(1);
    expect(targets[0].value).toBe(5);
  });

  it("increments a card description and matching mechanical amount", () => {
    const rng = makeRng([0, 0.9]);

    const result = corruptCard(makeCard(), [makeCard()], rng);
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.corruptedCard.descriptionLines).toEqual(["Deal 6 Physical damage"]);
    expect(result.corruptedCard.effects[0]).toMatchObject({ amount: 6 });
    expect(result.corruptedCard.corrupted).toBe(true);
    expect(result.corruptedCard.title).toBe("Slash");
  });

  it("decrements a card description and matching mechanical amount", () => {
    const rng = makeRng([0, 0.1]);

    const result = corruptCard(makeCard(), [makeCard()], rng);
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.corruptedCard.descriptionLines).toEqual(["Deal 4 Physical damage"]);
    expect(result.corruptedCard.effects[0]).toMatchObject({ amount: 4 });
  });

  it("allows corruption to reduce a value to 0", () => {
    const rng = makeRng([0, 0.1]);
    const anvil = makeCard({
      id: "anvil",
      title: "Anvil",
      descriptionLines: ["Gain 1 Forge"],
      effects: [{ kind: "player-status", status: "forge", amount: 1 }],
    });

    const result = corruptCard(anvil, [anvil], rng);
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.corruptedCard.descriptionLines).toEqual(["Gain 0 Forge"]);
    expect(result.corruptedCard.effects[0]).toMatchObject({ amount: 0 });
  });

  it("falls back to transforming cards with no editable numeric description", () => {
    const rng = makeRng([0, 0, 0.9]);
    const cleanse = makeCard({
      id: "cleanse",
      title: "Cleanse",
      descriptionLines: ["Remove a harmful status effect"],
      effects: [{ kind: "remove-harmful-status", amount: 1 }],
    });
    const slash = makeCard();

    const result = corruptCard(cleanse, [cleanse, slash], rng);
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.transformed).toBe(true);
    expect(result.corruptedCard.id).toBe("slash");
    expect(result.corruptedCard.descriptionLines).toEqual(["Deal 6 Physical damage"]);
  });

  it("excludes mixed potion cards from transform candidates", () => {
    expect(isSpecialCorruptionCard(makeCard({ id: "mixed-potion" }))).toBe(true);
    expect(isSpecialCorruptionCard(makeCard({ id: "mixed-potion-123" }))).toBe(true);
    expect(isSpecialCorruptionCard(makeCard({ id: "slash" }))).toBe(false);
  });

  it("replaces only the selected deck slot", () => {
    const rng = makeRng([0.9, 0, 0.9]);
    const slash = makeCard();
    const stab = makeCard({
      id: "stab",
      title: "Stab",
      descriptionLines: ["Deal 4 Physical damage"],
      effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
    });

    const result = corruptDeckCard([slash, stab], 1, [slash, stab], rng);

    expect(result.deck[0]).toBe(slash);
    expect(result.deck[1].descriptionLines).toEqual(["Deal 5 Physical damage"]);
    expect(result.result?.originalCard.id).toBe("stab");
  });

  it("transforms when random < 0.2 even with editable targets", () => {
    const rng = makeRng([0.1, 0, 0, 0.9]);
    const slash = makeCard();
    const bash = makeCard({
      id: "bash",
      title: "Bash",
      descriptionLines: ["Deal 8 Physical damage"],
      effects: [{ kind: "damage", damageType: "physical", amount: 8 }],
    });

    const result = corruptCard(slash, [slash, bash], rng);
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.transformed).toBe(true);
    expect(result.corruptedCard.id).toBe("bash");
    expect(result.corruptedCard.effects[0]).toMatchObject({ amount: 9 });
  });

  it("mutates directly when the transform roll reaches 0.2", () => {
    const rng = makeRng([0.2, 0, 0.9]);
    const slash = makeCard();
    const bash = makeCard({
      id: "bash",
      title: "Bash",
      descriptionLines: ["Deal 8 Physical damage"],
      effects: [{ kind: "damage", damageType: "physical", amount: 8 }],
    });

    const result = corruptCard(slash, [slash, bash], rng);
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.transformed).toBe(false);
    expect(result.corruptedCard.id).toBe("slash");
    expect(result.corruptedCard.effects[0]).toMatchObject({ amount: 6 });
  });

  it("returns null when the selected card cannot mutate or transform", () => {
    const rng = makeRng([0]);
    const cleanse = makeCard({
      id: "cleanse",
      title: "Cleanse",
      descriptionLines: ["Remove a harmful status effect"],
      effects: [{ kind: "remove-harmful-status", amount: 1 }],
    });
    const mixed = makeCard({
      id: "mixed-potion",
      title: "Mixed Potion",
      descriptionLines: ["Deal 5 Physical damage"],
      effects: [makeEffect("physical", 5)],
    });

    expect(corruptCard(cleanse, [cleanse, mixed], rng)).toBeNull();
    expect(corruptDeckCard([cleanse], 0, [cleanse, mixed], rng)).toEqual({ deck: [cleanse], result: null });
  });

  it("handles multi-number lines with multiple matching effects accurately", () => {
    const multiCard = makeCard({
      id: "split-strike",
      title: "Split Strike",
      descriptionLines: ["Deal 3 Physical damage and 5 Bleed"],
      effects: [makeEffect("physical", 3), { kind: "damage", damageType: "bleed", amount: 5 }],
    });

    const targets = getEditableCorruptionTargets(multiCard);
    expect(targets).toHaveLength(2);
    expect(targets[0]).toMatchObject({ lineIndex: 0, value: 3, effectIndex: 0 });
    expect(targets[1]).toMatchObject({ lineIndex: 0, value: 5, effectIndex: 1 });
  });

  it("skips numbers in description lines that have no corresponding mechanical effect amount", () => {
    const attackEnemiesCard = makeCard({
      id: "cleave",
      title: "Cleave",
      descriptionLines: ["Deal 6 Physical damage to 2 enemies"],
      effects: [makeEffect("physical", 6)],
    });

    const targets = getEditableCorruptionTargets(attackEnemiesCard);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ lineIndex: 0, value: 6, effectIndex: 0 });
  });
});

describe("replaceNumberAt", () => {
  it("replaces leading number at exact offset without disturbing other numbers", () => {
    const line = "Deal 5 Physical damage and 10 Holy damage";
    expect(replaceNumberAt(line, 5, 6)).toBe("Deal 6 Physical damage and 10 Holy damage");
    expect(replaceNumberAt(line, 27, 11)).toBe("Deal 5 Physical damage and 11 Holy damage");
  });

  it("returns unchanged line if matchIndex is out of bounds or points to non-number", () => {
    const line = "Deal 5 damage";
    expect(replaceNumberAt(line, -1, 9)).toBe("Deal 5 damage");
    expect(replaceNumberAt(line, 50, 9)).toBe("Deal 5 damage");
    expect(replaceNumberAt(line, 0, 9)).toBe("Deal 5 damage");
  });
});
