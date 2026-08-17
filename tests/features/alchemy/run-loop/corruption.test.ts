import { describe, expect, it } from "vitest";
import { corruptCard, corruptDeckCard, getEditableCorruptionTargets, isSpecialCorruptionCard } from "@/lib/corruption";
import { getCardDisplayTitle } from "@/features/alchemy/shared/ui/card-description-ui";
import type { BattleCard } from "@/lib/game-data";
import { makeTestCard } from "../../../fixtures/cards";
import { makeEffect } from "../../../fixtures/battle";

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

  it("transforms when random < 0.5 even with editable targets", () => {
    const rng = makeRng([0.4, 0, 0, 0.9]);
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
});

describe("getCardDisplayTitle", () => {
  it("returns plain title for a normal card", () => {
    expect(getCardDisplayTitle({ title: "Slash" })).toBe("Slash");
  });

  it("prefixes corrupted card title with 'Corrupted '", () => {
    expect(getCardDisplayTitle({ title: "Slash", corrupted: true })).toBe("Corrupted Slash");
  });

  it("handles missing corrupted field as normal", () => {
    expect(getCardDisplayTitle({ title: "Block", corrupted: false })).toBe("Block");
  });
});
