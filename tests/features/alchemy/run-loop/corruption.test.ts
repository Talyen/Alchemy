import { describe, expect, it } from "vitest";
import { corruptCard, corruptDeckCard, getEditableCorruptionTargets, isSpecialCorruptionCard } from "@/lib/corruption";
import { getCorruptionMutationGroups } from "@/lib/corruption/mutations";
import { applyNumericCorruption, updateCardNumericValue } from "@/lib/corruption/numeric";
import {
  cardById,
  cardLibrary,
  cloneBattleCard,
  describeCardEffects,
  withCardDescription,
  type BattleCardEffect,
} from "@/lib/game-data";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import type { CORRUPTION_OUTCOME_WEIGHTS } from "@/lib/game-constants";
import { addCorruptionEffect, removeConsume } from "@/lib/corruption/card-edits";
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
  it("never adds a Health price or Consume when the promised upgrade exceeds supported values", () => {
    for (const amount of [500, 999]) {
      const card = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount }] });
      const kinds = getCorruptionMutationGroups(card).map((group) => group.kind);
      expect(kinds).not.toContain("bargain");
      expect(kinds).not.toContain("consume");
      expect(kinds).toContain("weaken");
    }
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 499 }] });
    const bargain = getCorruptionMutationGroups(card).find((group) => group.kind === "bargain")!;
    expect(bargain.mutations[0]!.card.effects).toEqual([
      { kind: "lose-health", amount: 2 },
      { kind: "damage", damageType: "physical", amount: 998 },
    ]);
  });
  it("can add Block to an Armor card without adding duplicate Block to a Block card", () => {
    const secondaryEffects = (id: string) =>
      getCorruptionMutationGroups(cardById[id]!)
        .find((group) => group.kind === "secondary")!
        .mutations.map(({ card }) => card.effects.at(-1));
    expect(secondaryEffects("golden-plate")).toContainEqual({ kind: "player-status", status: "block", amount: 2 });
    expect(secondaryEffects("block")).not.toContainEqual({ kind: "player-status", status: "block", amount: 2 });
  });

  it("marks a damage conversion even when its amount stays the same", () => {
    const group = getCorruptionMutationGroups(cardById["lightning-bolt"]!).find((entry) => entry.kind === "convert")!;
    const next = group.mutations.find(
      ({ card }) => card.effects[0]?.kind === "damage" && card.effects[0].damageType === "holy",
    )!.card;
    expect(next.descriptionLines).toEqual(["Deal 4 Holy damage"]);
    expect(next.description![0]!.parts).toContainEqual(expect.objectContaining({ corrupted: true }));
  });

  it("strengthens ordinary damage proportionally and scarce resources by one", () => {
    expect(outcome("slash", "strengthen").descriptionLines).toEqual(["Deal 6 Physical damage"]);
    expect(outcome("slash", "strengthen").effects).toEqual([{ kind: "damage", damageType: "physical", amount: 6 }]);
    expect(outcome("anvil", "strengthen").descriptionLines).toEqual(["Gain 3 Forge"]);
    expect(outcome("fireball", "strengthen").descriptionLines).toEqual(["Deal 3 Burn damage"]);
  });

  it("treats reducing Health loss as strengthening and assigns a positive delta", () => {
    const next = outcome("faustian-bargain", "strengthen");
    expect(next.descriptionLines[0]).toBe("Lose 1 Health");
    expect(next.effects[0]).toEqual({ kind: "lose-health", amount: 1 });
    const strengthenGroup = getCorruptionMutationGroups(cardById["faustian-bargain"]!).find(
      (entry) => entry.kind === "strengthen",
    )!;
    expect(strengthenGroup.mutations[0]!.delta).toBe(1);
    const weakenGroup = getCorruptionMutationGroups(cardById["faustian-bargain"]!).find(
      (entry) => entry.kind === "weaken",
    )!;
    expect(weakenGroup.mutations[0]!.delta).toBe(-1);
  });

  it("charges the Health price before granting the larger benefit", () => {
    const next = outcome("block", "bargain");
    expect(next.descriptionLines).toEqual(["Lose 2 Health", "Gain 10 Block"]);
    expect(next.effects).toEqual([
      { kind: "lose-health", amount: 2 },
      { kind: "player-status", status: "block", amount: 10 },
    ]);
  });

  it("removes Consume explicitly so it cannot return on hydration", () => {
    const next = outcome("health-potion", "reusable");
    expect(next.consume).toBe(false);
    expect(hydrateCard(next).consume).toBe(false);
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
      description: ["One", "Two", "Three", "Four"].map((line) => ({ parts: [line], role: "effect" })),
      effects: [{ kind: "next-hit-crit" }],
    });
    expect(getCorruptionMutationGroups(card)).toEqual([]);
    const shortCard = withCardDescription(card, [
      { parts: ["Your next damaging card is a critical strike"], role: "effect" },
    ]);
    expect(getCorruptionMutationGroups(shortCard).map((group) => group.kind)).toEqual(["secondary"]);
  });

  it.each(["earthquake", "blizzard"])("keeps %s repeated effects aligned", (id) => {
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
    expect(result?.corruptedCard.descriptionLines).toEqual(["Deal 6 Physical damage", "Gain 2 Block"]);
    expect(result?.corruptedCard.effects).toHaveLength(2);
  });

  it("twin-offering chains the second gift onto the first", () => {
    const card = makeTestCard({
      descriptionLines: ["One", "Two", "Three"],
      description: ["One", "Two", "Three"].map((line) => ({ parts: [line], role: "effect" })),
      effects: [{ kind: "next-hit-crit" }],
    });
    const result = corruptCard(card, [card], makeRng([0, 0, 0, 0]), ["twin-offering"]);
    expect(result?.corruptedCard.descriptionLines).toEqual(["One", "Two", "Three", "Gain 3 Block"]);
    expect(result?.corruptedCard.effects).toHaveLength(2);
    expect(result?.delta).toBe(1);
  });

  it("twin-offering does not pair reusable with consume", () => {
    const potion = cardById["health-potion"]!;
    // Roll reusable as the first mutation
    const groups = getCorruptionMutationGroups(potion);
    const reusableIndex = groups.findIndex((g) => g.kind === "reusable");
    expect(reusableIndex).toBeGreaterThanOrEqual(0);
    const total = groups.reduce((sum, g) => sum + g.weight, 0);
    const reusableWeightBefore = groups.slice(0, reusableIndex).reduce((sum, g) => sum + g.weight, 0);
    const roll = (reusableWeightBefore + 0.1) / total;
    const result = corruptCard(potion, [potion], makeRng([roll, 0, 0, 0]), ["twin-offering"]);
    expect(result).not.toBeNull();
    // After removing consume via reusable, consume must not be re-added
    expect(result?.corruptedCard.consume).toBe(false);
  });

  it("safely handles boundary roll without failing corruptCard", () => {
    const slash = cardById.slash!;
    // Roll 0.9999999999 on weight selection
    const result = corruptCard(slash, [slash], makeRng([0.9999999999, 0]));
    expect(result).not.toBeNull();
    expect(result?.corruptedCard.corrupted).toBe(true);
  });
});

describe("numeric effect bindings", () => {
  it("keeps a cloned damage pool's immediate and scheduled amounts aligned", () => {
    const hit: BattleCardEffect = {
      kind: "damage",
      damageType: "physical",
      damageTypePool: ["physical", "holy"],
      amount: 3,
    };
    const effects: BattleCardEffect[] = [hit, { kind: "repeat-over-turns", remainingTurns: 1, effects: [hit] }];
    const card = cloneBattleCard(makeTestCard({ effects, descriptionLines: describeCardEffects(effects) }));
    const before = structuredClone(card);
    const targets = getEditableCorruptionTargets(card);
    expect(targets).toHaveLength(1);
    const changed = applyNumericCorruption(card, targets[0]!, 1);
    expect(changed.descriptionLines).toEqual(["Deal 4 Physical or Holy damage this turn and next"]);
    expect(changed.effects[0]).toMatchObject({ amount: 4 });
    expect(changed.effects[1]).toMatchObject({ effects: [changed.effects[0]] });
    expect(card).toEqual(before);
  });

  it("rejects a stale shared edit without changing any branch or its description", () => {
    const card = cardById["luck-potion"]!;
    const target = getEditableCorruptionTargets(card)[1]!;
    expect(target.edits).toHaveLength(2);
    const altered = makeTestCard({
      ...card,
      effects: card.effects.map((effect) =>
        effect.kind === "chance"
          ? {
              ...effect,
              failureEffects: effect.failureEffects.map((child) =>
                child.kind === "chance"
                  ? { ...child, failureEffects: [{ kind: "player-status", status: "block", amount: target.value + 1 }] }
                  : child,
              ),
            }
          : effect,
      ),
    });
    // Gold is unchanged, but Block no longer shares its displayed value.
    expect(updateCardNumericValue(altered, target, target.value + 2)).toBe(altered);
    expect(applyNumericCorruption(altered, target, 2)).toBe(altered);
  });

  it("applies an explicit shared edit after a card is serialized, keeping an independent delayed value", () => {
    const hit = { kind: "damage" as const, damageType: "physical" as const, amount: 3 };
    const card = makeTestCard({
      descriptionLines: ["Deal 3 Physical damage this turn and next", "Deal 3 Physical damage next turn"],
      effects: [
        hit,
        { kind: "repeat-over-turns", remainingTurns: 1, effects: [{ ...hit }] },
        { kind: "repeat-over-turns", remainingTurns: 1, effects: [{ ...hit }] },
      ],
    });
    const target = getEditableCorruptionTargets(card)[0]!;
    const restored = JSON.parse(JSON.stringify(card)) as typeof card;
    const changed = updateCardNumericValue(restored, target, 4);
    expect(changed.descriptionLines).toEqual([
      "Deal 4 Physical damage this turn and next",
      "Deal 3 Physical damage next turn",
    ]);
    expect(changed.effects).toEqual([
      { ...hit, amount: 4 },
      { kind: "repeat-over-turns", remainingTurns: 1, effects: [{ ...hit, amount: 4 }] },
      { kind: "repeat-over-turns", remainingTurns: 1, effects: [hit] },
    ]);
    expect(restored).toEqual(card);
  });

  it("keeps Ice Shot's implicit Frozen damage doubled after numeric changes", () => {
    const card = cardById["ice-shot"]!;
    const target = getEditableCorruptionTargets(card)[0]!;
    const changed = applyNumericCorruption(card, target, 1);
    expect(changed.descriptionLines).toContain("Deal 3 Freeze damage");
    expect(changed.effects[0]).toMatchObject({ amount: 3, amountIfTargetFrozen: 6 });
    expect(card.effects[0]).toMatchObject({ amount: 2, amountIfTargetFrozen: 4 });
  });

  it.each(["wishing-well", "cauterize", "ray-of-frost"])(
    "keeps %s's implicit and shared quantities separate from an added effect",
    (id) => {
      const card = getCorruptionMutationGroups(cardById[id]!)
        .find((group) => group.kind === "secondary")!
        .mutations.find(({ card: candidate }) => {
          const effect = candidate.effects.at(-1);
          return effect?.kind === "damage" && effect.damageType === "poison";
        })!.card;
      const lineIndex = card.descriptionLines.indexOf("Deal 1 Poison damage");
      const target = getEditableCorruptionTargets(card).find((entry) => entry.lineIndex === lineIndex)!;
      const changed = updateCardNumericValue(card, target, 2);
      expect(changed.effects.slice(0, -1)).toEqual(card.effects.slice(0, -1));
      expect(changed.effects.at(-1)).toMatchObject({ kind: "damage", damageType: "poison", amount: 2 });
      expect(changed.descriptionLines[lineIndex]).toBe("Deal 2 Poison damage");
    },
  );

  it("updates the pooled damage amount on maul", () => {
    const original = cardById.maul!;
    const target = getEditableCorruptionTargets(original)[0]!;
    const changed = applyNumericCorruption(original, target, 1);
    expect(changed.descriptionLines[0]).toBe("Deal 4 Bleed or Stun damage");
    expect(changed.effects[0]).toMatchObject({
      kind: "damage",
      amount: 4,
      damageType: "bleed",
      damageTypePool: ["bleed", "stun"],
    });
  });

  it("keeps a shared conditional number separate from an equal-valued added effect", () => {
    const original = cardById.maul!;
    const card = addCorruptionEffect(original, { kind: "gain-gold", amount: 3 });
    const targets = getEditableCorruptionTargets(card);
    expect(targets).toHaveLength(2);
    const changed = applyNumericCorruption(card, targets[1]!, 1);
    expect(changed.effects[0]).toEqual(original.effects[0]);
    expect(changed.effects[1]).toEqual({ kind: "gain-gold", amount: 4 });
    expect(changed.descriptionLines[1]).toBe("Gain 4 Gold");
  });
});

it("removing Consume retains bound highlights and clears the keyword without changing the input", () => {
  const source = outcome("health-potion", "strengthen");
  const card = { ...source, tags: ["consume" as const] };
  const before = structuredClone(card);
  const reusable = removeConsume(card);
  expect(reusable.consume).toBe(false);
  expect(reusable.tags).toEqual([]);
  expect(reusable.description).toEqual(card.description!.filter((line) => line.role !== "consume"));
  expect(card).toEqual(before);
});
