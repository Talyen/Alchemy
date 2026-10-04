import { describe, expect, it } from "vitest";
import { selectRewardCards } from "@/lib/game-data";
import type { BattleCard } from "@/lib/game-data";
import { createSeededRng } from "@/lib/rng";

function card(overrides: Partial<BattleCard> = {}): BattleCard {
  return { id: "test", title: "Test", descriptionLines: [""], art: "", cost: 1, effects: [], ...overrides };
}

function companionCard(id: string): BattleCard {
  return card({ id, effects: [{ kind: "summon-companion", companionId: "wolf" }] });
}

function physicalCard(id: string): BattleCard {
  return card({ id, effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
}

describe("selectRewardCards", () => {
  it.each([
    { count: 1, ids: ["card-36"], nextRandom: 0.384123298805207 },
    { count: 3, ids: ["card-36", "card-1", "card-33"], nextRandom: 0.01149781048297882 },
    {
      count: 9,
      ids: ["card-36", "card-1", "card-11", "card-14", "card-19", "card-2", "card-13", "card-12", "card-38"],
      nextRandom: 0.25641172588802874,
    },
  ])("preserves ranked ties and RNG with $count rewards from a larger pool", ({ count, ids, nextRandom }) => {
    // Pin the offered cards and next RNG value so a refactor cannot reroll later rewards.
    const pool = Array.from({ length: 40 }, (_, index) =>
      card({
        id: `card-${index}`,
        effects:
          index % 3 === 0
            ? [{ kind: "damage", damageType: "physical", amount: 5 }]
            : index % 3 === 1
              ? [{ kind: "heal", amount: 5 }]
              : [],
      }),
    );
    const rng = createSeededRng(37);
    expect(selectRewardCards([pool[0]!], pool, count, [], rng, ["physical"]).map((entry) => entry.id)).toEqual(ids);
    expect(rng()).toBe(nextRandom);
  });

  it.each([
    {
      seed: 7,
      count: 3,
      hasCompanion: false,
      ids: ["fox", "strike-0", "wolf"],
      nextRandom: 0.2475335942581296,
    },
    {
      seed: 42,
      count: 3,
      hasCompanion: true,
      ids: ["fox", "strike-0", "strike-3"],
      nextRandom: 0.003842951962724328,
    },
    {
      seed: 99,
      count: 12,
      hasCompanion: false,
      ids: ["fox", "plain", "wolf", "strike-0", "strike-2", "strike-3", "heal"],
      nextRandom: 0.24224883294664323,
    },
    {
      seed: 123,
      count: 0,
      hasCompanion: true,
      ids: [],
      nextRandom: 0.18843599455431104,
    },
  ])("preserves rewards and subsequent randomness for seed $seed", ({ seed, count, hasCompanion, ids, nextRandom }) => {
    const pool = [
      companionCard("wolf"),
      companionCard("fox"),
      ...Array.from({ length: 4 }, (_, index) => physicalCard(`strike-${index}`)),
      card({ id: "heal", effects: [{ kind: "heal", amount: 5 }] }),
      card({ id: "plain" }),
    ];
    const deck = [physicalCard("strike-0"), ...(hasCompanion ? [companionCard("owned-wolf")] : [])];
    Object.freeze(pool);
    Object.freeze(deck);
    const rng = createSeededRng(seed);
    const rewards = selectRewardCards(deck, pool, count, [card({ id: "strike-1" })], rng, ["health"]);

    expect(rewards.map((entry) => entry.id)).toEqual(ids);
    expect(rng()).toBe(nextRandom);
    expect(rewards).not.toContainEqual(expect.objectContaining({ id: "strike-1" }));
    expect(new Set(rewards).size).toBe(rewards.length);
  });

  it("uses seed keywords before a draft has any cards", () => {
    const allCards: BattleCard[] = [
      card({ id: "block", effects: [{ kind: "player-status", status: "block", amount: 5 }] }),
      card({ id: "burn", effects: [{ kind: "damage", damageType: "burn", amount: 3 }] }),
    ];

    let roll = false;
    const rng = () => {
      roll = !roll;
      return roll ? 0.99 : 0.0;
    };
    const result = selectRewardCards([], allCards, 1, [], rng, ["block"]);

    expect(result[0].id).toBe("block");
  });

  it("combines seed keyword and drafted-card affinity", () => {
    const drafted = [card({ id: "drafted-burn", effects: [{ kind: "damage", damageType: "burn", amount: 2 }] })];
    const allCards: BattleCard[] = [
      card({ id: "block", effects: [{ kind: "player-status", status: "block", amount: 5 }] }),
      card({ id: "burn", effects: [{ kind: "damage", damageType: "burn", amount: 3 }] }),
      card({ id: "plain" }),
    ];

    let roll = false;
    const rng = () => {
      roll = !roll;
      return roll ? 0.99 : 0.0;
    };
    const result = selectRewardCards(drafted, allCards, 2, drafted, rng, ["block"]);

    expect(result.map((entry) => entry.id).sort()).toEqual(["block", "burn"]);
  });

  it("does not offer the same card ID twice when candidate objects differ", () => {
    const result = selectRewardCards([], [card({ id: "a" }), card({ id: "a" }), card({ id: "b" })], 3, [], () => 0);
    expect(result.map((entry) => entry.id).sort()).toEqual(["a", "b"]);
  });
});

it("keeps ordinary rewards when owned Companions are dampened out", () => {
  const pool = [companionCard("wolf"), physicalCard("strike")];
  const rewards = selectRewardCards([companionCard("owned-wolf")], pool, 3, [], () => 0.99);
  expect(rewards.map((entry) => entry.id)).toEqual(["strike"]);
});

it("falls back to the original pool when dampening would leave no rewards", () => {
  const pool = [companionCard("wolf"), companionCard("fox")];
  const rewards = selectRewardCards([companionCard("owned-wolf")], pool, 3, [], () => 0.99);
  expect(rewards.map((entry) => entry.id).sort()).toEqual(["fox", "wolf"]);
});
