import { describe, expect, it } from "vitest";
import {
  corruptCard,
  corruptDeckCard,
  getEditableCorruptionTargets,
  isSpecialCorruptionCard,
  replaceNumberAt,
} from "@/lib/corruption";
import { getCorruptionMutationGroups } from "@/lib/corruption/mutations";
import { applyNumericCorruption } from "@/lib/corruption/numeric";
import { cardById, cardLibrary } from "@/lib/game-data";
import type { CORRUPTION_OUTCOME_WEIGHTS } from "@/lib/game-constants";
import { makeTestCard } from "../../../fixtures/cards";

function makeRng(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? 0;
}

function outcome(id: string, kind: keyof typeof CORRUPTION_OUTCOME_WEIGHTS) {
  const group = getCorruptionMutationGroups(cardById[id]!).find((entry) => entry.kind === kind);
  expect(group, `${id}: ${kind}`).toBeDefined();
  return group!.mutations[0]!.card;
}

describe("card corruption outcomes", () => {
  it("strengthens ordinary damage proportionally and scarce resources by one", () => {
    expect(outcome("slash", "strengthen").descriptionLines).toEqual(["Deal 9 Physical damage"]);
    expect(outcome("slash", "strengthen").effects).toEqual([{ kind: "damage", damageType: "physical", amount: 9 }]);
    expect(outcome("anvil", "strengthen").descriptionLines).toEqual(["Gain 3 Forge"]);
    expect(outcome("fireball", "strengthen").descriptionLines).toEqual(["Deal 3 Burn damage"]);
  });

  it("weakens damage and can reduce a scarce resource to zero", () => {
    expect(outcome("slash", "weaken").descriptionLines).toEqual(["Deal 4 Physical damage"]);
    const card = makeTestCard({
      descriptionLines: ["Gain 1 Forge"],
      effects: [{ kind: "player-status", status: "forge", amount: 1 }],
    });
    const next = getCorruptionMutationGroups(card).find((group) => group.kind === "weaken")!.mutations[0]!.card;
    expect(next.effects).toEqual([{ kind: "player-status", status: "forge", amount: 0 }]);
  });

  it("treats reducing Health loss as strengthening", () => {
    const next = outcome("faustian-bargain", "strengthen");
    expect(next.descriptionLines[0]).toBe("Lose 1 Health");
    expect(next.effects[0]).toEqual({ kind: "lose-health", amount: 1 });
  });

  it("adds one effect before trailing keywords and marks its number", () => {
    const next = outcome("fire-arrow", "secondary");
    expect(next.descriptionLines).toEqual(["Deal 1 Burn damage", "Remove 2 enemy Armor", "Gain 2 Block", "Archery"]);
    expect(next.effects[2]).toEqual({ kind: "player-status", status: "block", amount: 2 });
    expect(next.corruptedValuePositions).toEqual([{ lineIndex: 2, matchIndex: 5 }]);
  });

  it("charges the Health price before granting the larger benefit", () => {
    const next = outcome("block", "bargain");
    expect(next.descriptionLines).toEqual(["Lose 2 Health", "Gain 10 Block"]);
    expect(next.effects).toEqual([
      { kind: "lose-health", amount: 2 },
      { kind: "player-status", status: "block", amount: 10 },
    ]);
    expect(next.corruptedValuePositions).toEqual([
      { lineIndex: 1, matchIndex: 5 },
      { lineIndex: 0, matchIndex: 5 },
    ]);
  });

  it("converts damage using the new type's magnitude while retaining the card", () => {
    const group = getCorruptionMutationGroups(cardById.slash!).find((entry) => entry.kind === "convert")!;
    const next = group.mutations.find(
      ({ card }) => card.effects[0]?.kind === "damage" && card.effects[0].damageType === "poison",
    )!.card;
    expect(next.id).toBe("slash");
    expect(next.descriptionLines).toEqual(["Deal 2 Poison damage"]);
    expect(next.effects).toEqual([{ kind: "damage", damageType: "poison", amount: 2 }]);
  });

  it.each([
    ["draw", "Draw a card", { kind: "draw-cards", amount: 1 }],
    ["mana", "Gain 1 Mana", { kind: "restore-mana", amount: 1 }],
  ] as const)("adds the %s jackpot without changing Mana cost", (kind, line, effect) => {
    const next = outcome("slash", kind);
    expect(next.cost).toBe(cardById.slash!.cost);
    expect(next.descriptionLines).toEqual(["Deal 6 Physical damage", line]);
    expect(next.effects[1]).toEqual(effect);
  });

  it("adds Leech to the actual damage effect", () => {
    const next = outcome("slash", "leech");
    expect(next.descriptionLines).toEqual(["Deal 6 Physical damage", "Leech"]);
    expect(next.effects[0]).toMatchObject({ lifesteal: true });
  });

  it("triples a simple effect when adding Consume", () => {
    const next = outcome("slash", "consume");
    expect(next.consume).toBe(true);
    expect(next.descriptionLines).toEqual(["Deal 18 Physical damage", "Consume"]);
    expect(next.effects[0]).toMatchObject({ amount: 18 });
  });

  it("removes Consume explicitly so it cannot return on hydration", () => {
    const next = outcome("health-potion", "reusable");
    expect(next.consume).toBe(false);
    expect(next.descriptionLines).toEqual(["Restore 8 Health"]);
    expect(next.effects).toEqual(cardById["health-potion"]!.effects);
  });

  it.each(["haste", "mana-crystals", "mana-potion", "faustian-bargain", "shadowstep", "wolf-companion"])(
    "does not make %s reusable",
    (id) => {
      expect(cardById[id]).toBeDefined();
      expect(getCorruptionMutationGroups(cardById[id]!).some((group) => group.kind === "reusable")).toBe(false);
    },
  );

  it.each(["dark-pact", "blood-offering", "mana-potion", "ray-of-frost", "blessed-aegis"])(
    "does not add draw, Mana, or Consume to complex or resource-generating %s",
    (id) => {
      const kinds = getCorruptionMutationGroups(cardById[id]!).map((group) => group.kind);
      expect(kinds).not.toContain("draw");
      expect(kinds).not.toContain("mana");
      expect(kinds).not.toContain("consume");
    },
  );

  it("caps added effect text and still supports cards with no numeric targets", () => {
    const card = makeTestCard({
      descriptionLines: ["One", "Two", "Three", "Four"],
      effects: [{ kind: "next-hit-crit" }],
    });
    expect(getCorruptionMutationGroups(card)).toEqual([]);
    const shortCard = { ...card, descriptionLines: ["Your next damaging card is a critical strike"] };
    expect(getCorruptionMutationGroups(shortCard).map((group) => group.kind)).toEqual(["secondary"]);
  });

  it.each(["earthquake", "blizzard", "avatar"])("keeps %s repeated effects aligned", (id) => {
    const card = cardById[id]!;
    const original = structuredClone(card);
    const next = outcome(id, "strengthen");
    const repeat = next.effects.find((effect) => effect.kind === "repeat-over-turns");
    expect(repeat?.kind).toBe("repeat-over-turns");
    if (repeat?.kind === "repeat-over-turns") expect(repeat.effects[0]).toEqual(next.effects[0]);
    expect(card).toEqual(original);
  });

  it("excludes clamped no-ops from equal random-damage bounds", () => {
    const card = makeTestCard({
      descriptionLines: ["Deal 3–3 Random damage"],
      effects: [{ kind: "random-damage", minAmount: 3, maxAmount: 3 }],
    });
    const groups = getCorruptionMutationGroups(card);
    expect(groups.find((group) => group.kind === "strengthen")!.mutations[0]!.card.descriptionLines).toEqual([
      "Deal 3–4 Random damage",
    ]);
    expect(groups.find((group) => group.kind === "weaken")!.mutations[0]!.card.descriptionLines).toEqual([
      "Deal 2–3 Random damage",
    ]);
  });

  it("preserves catalog inputs and changes something mechanically in every candidate", () => {
    for (const original of cardLibrary) {
      const before = structuredClone(original);
      for (const group of getCorruptionMutationGroups(original)) {
        for (const { card } of group.mutations) {
          expect(card.corrupted).toBe(true);
          expect(card.cost).toBe(original.cost);
          expect({ effects: card.effects, consume: !!card.consume }).not.toEqual({
            effects: original.effects,
            consume: !!original.consume,
          });
          for (const pos of card.corruptedValuePositions ?? [])
            expect(card.descriptionLines[pos.lineIndex]!.slice(pos.matchIndex)).toMatch(/^\d/);
        }
      }
      expect(original).toEqual(before);
    }
  });
});

describe("corruption selection", () => {
  it("selects each eligible family by weight instead of number of variants", () => {
    const card = cardById.slash!;
    const groups = getCorruptionMutationGroups(card);
    const total = groups.reduce((sum, group) => sum + group.weight, 0);
    let offset = 0;
    for (const group of groups) {
      const result = corruptCard(card, [card], makeRng([(offset + group.weight / 2) / total, 0]));
      expect(result?.corruptedCard).toEqual(group.mutations[0]!.card);
      offset += group.weight;
    }
  });

  it("keeps transformation at ten percent and preserves the selected UID", () => {
    const slash = { ...cardById.slash!, uid: 42 };
    const library = [slash, { ...cardById.frostbolt!, uid: 123 }];
    const transformed = corruptCard(slash, library, makeRng([0.099, 0, 0, 0]));
    expect(transformed?.transformed).toBe(true);
    expect(transformed?.corruptedCard).toMatchObject({ id: "frostbolt", uid: 42, corrupted: true });
    expect(corruptCard(slash, library, makeRng([0.1, 0, 0]))?.transformed).toBe(false);
  });

  it("rejects another corruption without spending RNG", () => {
    const card = { ...cardById.slash!, corrupted: true };
    expect(
      corruptCard(card, cardLibrary, () => {
        throw new Error("must not roll");
      }),
    ).toBeNull();
  });

  it("replaces only the selected slot and is deterministic", () => {
    const deck = [cardById.slash!, cardById.block!];
    const first = corruptDeckCard(deck, 1, deck, makeRng([0.5, 0, 0]));
    expect(first.deck[0]).toBe(deck[0]);
    expect(first.deck[1]).not.toBe(deck[1]);
    expect(first).toEqual(corruptDeckCard(deck, 1, deck, makeRng([0.5, 0, 0])));
  });

  it("excludes generated Mixed Potions from transformation", () => {
    expect(isSpecialCorruptionCard({ id: "mixed-potion-123" })).toBe(true);
    const slash = cardById.slash!;
    expect(corruptCard(slash, [slash, { ...slash, id: "mixed-potion" }], makeRng([0]))?.transformed).toBe(false);
  });
});

describe("labyrinth corruption room modifiers", () => {
  it("steady-sigil removes weakening without touching strengthen", () => {
    const kinds = getCorruptionMutationGroups(cardById.slash!).map((group) => group.kind);
    expect(kinds).toContain("weaken");
    const steady = getCorruptionMutationGroups(cardById.slash!, ["steady-sigil"]);
    expect(steady.map((group) => group.kind)).not.toContain("weaken");
    expect(steady.map((group) => group.kind)).toContain("strengthen");
  });

  it("pure-altar keeps the selected card identity", () => {
    const slash = { ...cardById.slash! };
    const library = [slash, { ...cardById.frostbolt! }];
    expect(corruptCard(slash, library, makeRng([0.099, 0, 0, 0]))?.transformed).toBe(true);
    const pure = corruptCard(slash, library, makeRng([0.099, 0, 0, 0]), ["pure-altar"]);
    expect(pure?.transformed).toBe(false);
    expect(pure?.corruptedCard.id).toBe("slash");
  });

  it("blood-rite favors leech and conversion gifts", () => {
    const base = new Map(getCorruptionMutationGroups(cardById.slash!).map((group) => [group.kind, group.weight]));
    const blood = new Map(
      getCorruptionMutationGroups(cardById.slash!, ["blood-rite"]).map((group) => [group.kind, group.weight]),
    );
    expect(blood.get("leech")).toBe(base.get("leech")! * 3);
    expect(blood.get("convert")).toBe(base.get("convert")! * 2);
    expect(blood.get("strengthen")).toBe(base.get("strengthen"));
  });

  it("echoing-altar narrows secondary gifts to the card keywords", () => {
    const tagged = makeTestCard({
      descriptionLines: ["Deal 6 Physical damage"],
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
      tags: ["poison"],
    });
    const secondary = getCorruptionMutationGroups(tagged).find((group) => group.kind === "secondary")!;
    expect(secondary.mutations).toHaveLength(4);
    const echoed = getCorruptionMutationGroups(tagged, ["echoing-altar"]).find((group) => group.kind === "secondary")!;
    expect(echoed.mutations).toHaveLength(1);
    expect(echoed.mutations[0]!.card.descriptionLines).toContain("Deal 1 Poison damage");
  });

  it("echoing-altar narrows conversions to the card keywords with fallback", () => {
    const tagged = makeTestCard({
      descriptionLines: ["Deal 6 Physical damage"],
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
      tags: ["poison"],
    });
    const echoed = getCorruptionMutationGroups(tagged, ["echoing-altar"]).find((group) => group.kind === "convert")!;
    expect(echoed.mutations).toHaveLength(1);
    expect(echoed.mutations[0]!.card.effects[0]).toMatchObject({ damageType: "poison" });
    const fallback = getCorruptionMutationGroups(cardById.slash!, ["echoing-altar"]).find(
      (group) => group.kind === "convert",
    )!;
    expect(fallback.mutations.length).toBeGreaterThan(1);
  });

  it("twin-offering applies two gifts in one corruption", () => {
    const slash = { ...cardById.slash! };
    const result = corruptCard(slash, [slash], makeRng([0, 0, 0, 0]), ["twin-offering"]);
    expect(result?.transformed).toBe(false);
    expect(result?.delta).toBe(1);
    expect(result?.corruptedCard.corrupted).toBe(true);
    expect(result?.corruptedCard.descriptionLines).toEqual(["Deal 9 Physical damage", "Gain 2 Block"]);
    expect(result?.corruptedCard.effects).toHaveLength(2);
  });

  it("twin-offering chains the second gift onto the first", () => {
    const card = makeTestCard({
      descriptionLines: ["One", "Two", "Three"],
      effects: [{ kind: "next-hit-crit" }],
    });
    const result = corruptCard(card, [card], makeRng([0, 0, 0, 0]), ["twin-offering"]);
    expect(result?.corruptedCard.descriptionLines).toEqual(["One", "Two", "Three", "Gain 3 Block"]);
    expect(result?.corruptedCard.effects).toHaveLength(2);
    expect(result?.delta).toBe(1);
  });
});

describe("numeric text alignment", () => {
  it("matches multiple values and ignores unrelated numbers", () => {
    const card = makeTestCard({
      descriptionLines: ["Deal 3 Physical and 5 Bleed damage to 2 enemies"],
      effects: [
        { kind: "damage", damageType: "physical", amount: 3 },
        { kind: "damage", damageType: "bleed", amount: 5 },
      ],
    });
    expect(getEditableCorruptionTargets(card)).toMatchObject([
      { value: 3, effectIndex: 0 },
      { value: 5, effectIndex: 1 },
    ]);
  });

  it("moves existing highlights when the number gains a digit", () => {
    const card = makeTestCard({
      descriptionLines: ["Deal 9 Physical and 2 Bleed damage"],
      effects: [
        { kind: "damage", damageType: "physical", amount: 9 },
        { kind: "damage", damageType: "bleed", amount: 2 },
      ],
      corruptedValuePositions: [{ lineIndex: 0, matchIndex: 20 }],
    });
    const next = applyNumericCorruption(card, getEditableCorruptionTargets(card)[0]!, 1);
    expect(next.descriptionLines).toEqual(["Deal 10 Physical and 2 Bleed damage"]);
    expect(next.corruptedValuePositions).toContainEqual({ lineIndex: 0, matchIndex: 21 });
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
