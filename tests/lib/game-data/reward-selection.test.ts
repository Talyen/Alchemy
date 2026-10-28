import { describe, expect, it, vi } from "vitest";
import { selectRewardCards } from "@/lib/game-data";
import type { BattleCard } from "@/lib/game-data";
import { createSeededRng } from "@/lib/rng";
import { REWARD_SELECTION_CONFIG } from "@/lib/game-constants";

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
    Object.freeze(pool);
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
      nextRandom: 0.4560541172977537,
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

  it("leaves gameplay randomness untouched when no reward can be selected", () => {
    const pool = [physicalCard("strike"), companionCard("wolf")];
    const rng = vi.fn(() => 0.5);
    expect(selectRewardCards(pool, pool, 0, [], rng)).toEqual([]);
    expect(selectRewardCards(pool, pool, 3, pool, rng)).toEqual([]);
    expect(rng).not.toHaveBeenCalled();
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

it("keeps ordinary rewards first and fills missing choices after Companion dampening", () => {
  const pool = [companionCard("wolf"), physicalCard("strike")];
  const owned = companionCard("owned-wolf");
  owned.effects = [{ kind: "repeat-over-turns", remainingTurns: 2, effects: owned.effects }];
  const nested = companionCard("nested-fox");
  nested.effects = [{ kind: "chance", probability: 0.5, successEffects: [], failureEffects: nested.effects }];
  const rewards = selectRewardCards([owned], [...pool, nested], 3, [], () => 0.99);
  expect(rewards[0]?.id).toBe("strike");
  expect(new Set(rewards.map((entry) => entry.id))).toEqual(new Set(["strike", "wolf", "nested-fox"]));
});

it("constrained Companion rewards fills all available choices even when owned-Companion weighting rejects most candidates", () => {
  const pool = [companionCard("wolf"), companionCard("fox"), companionCard("bear")];
  let calls = 0;
  const rng = () => (calls++ === 0 ? 0 : 0.99);
  const selected = selectRewardCards([companionCard("owned")], pool, 3, [], rng);
  expect(new Set(selected.map((entry) => entry.id))).toEqual(new Set(pool.map((entry) => entry.id)));
});

it("honors companion weights above two while retaining all other candidates", () => {
  const config = REWARD_SELECTION_CONFIG as { companionlessRandomWeight: number };
  const original = config.companionlessRandomWeight;
  config.companionlessRandomWeight = 3;
  try {
    const rng = vi.fn(() => 0);
    const choices = selectRewardCards([], [companionCard("wolf"), card({ id: "plain" })], 1, [], rng);
    expect(choices).toHaveLength(1);
    // Four weighted entries require three shuffle draws; the two-card affinity
    // pool, pool choice, and selection each require one more.
    expect(rng).toHaveBeenCalledTimes(6);
  } finally {
    config.companionlessRandomWeight = original;
  }
});
