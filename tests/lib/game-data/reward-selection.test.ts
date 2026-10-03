import { describe, expect, it } from "vitest";
import { selectRewardCards } from "@/lib/game-data";
import type { BattleCard } from "@/lib/game-data";

function card(overrides: Partial<BattleCard> = {}): BattleCard {
  return { id: "test", title: "Test", descriptionLines: [""], art: "", cost: 1, effects: [], ...overrides };
}

function companionCard(id: string): BattleCard {
  return card({ id, effects: [{ kind: "summon-companion", companionId: "wolf" }] });
}

function physicalCard(id: string): BattleCard {
  return card({ id, effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
}

function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
    // Captured from full stable sorting before introducing the bounded shortlist.
    // Nine rewards also exercises the larger-request sort path.
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
    const rng = mulberry32(37);
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
    const rng = mulberry32(seed);
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

describe("companionless boost", () => {
  it("offers companions more often until the deck has one, then dampens them", () => {
    const pool: BattleCard[] = [
      companionCard("wolf-companion"),
      ...Array.from({ length: 6 }, (_, index) => physicalCard(`slash-${index}`)),
      ...Array.from({ length: 6 }, (_, index) => card({ id: `plain-${index}` })),
    ];
    const freshDeck = [physicalCard("stab"), physicalCard("jab")];
    const companionDeck = [...freshDeck, companionCard("owned-wolf")];

    function hitRate(deck: BattleCard[], trials: number): number {
      let hits = 0;
      for (let i = 0; i < trials; i += 1) {
        const picked = selectRewardCards(deck, pool, 3, [], mulberry32(5000 + i));
        if (picked.some((entry) => entry.id === "wolf-companion")) hits += 1;
      }
      return hits / trials;
    }

    const boosted = hitRate(freshDeck, 1000);
    const normal = hitRate(companionDeck, 1000);
    expect(boosted).toBeGreaterThan(normal + 0.1);
  });
});

describe("owned companion dampening", () => {
  it("offers companions about half as often once the deck has one", () => {
    const pool: BattleCard[] = [
      companionCard("wolf-companion"),
      ...Array.from({ length: 12 }, (_, index) => physicalCard(`slash-${index}`)),
    ];
    const deck = [physicalCard("owned-stab"), companionCard("owned-wolf")];

    function hitRate(trials: number): number {
      let hits = 0;
      for (let i = 0; i < trials; i += 1) {
        const picked = selectRewardCards(deck, pool, 3, [], mulberry32(7000 + i));
        if (picked.some((entry) => entry.id === "wolf-companion")) hits += 1;
      }
      return hits / trials;
    }

    const uniformBaseline = 3 / 13;
    const rate = hitRate(3000);
    expect(rate).toBeLessThan(uniformBaseline * 0.75);
    expect(rate).toBeGreaterThan(uniformBaseline * 0.25);
  });
});
