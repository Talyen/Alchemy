import { describe, expect, it } from "vitest";
import { defaultBattleState, defaultTalentEffects } from "@/lib/battle";
import { drawCards, shuffleCards } from "@/lib/battle/draw";
import { MAX_HAND_SIZE } from "@/lib/game-constants";
import { makeTestCardWithId } from "../../fixtures/battle";

const makeCard = makeTestCardWithId;

describe("defaultTalentEffects", () => {
  it("has all numeric fields set to 0 except known non-zero defaults", () => {
    const nonZeroDefaults = new Set(["bleedDesperateMultiplier", "healMultiplier", "potionPotency"]);
    for (const [key, value] of Object.entries(defaultTalentEffects)) {
      if (typeof value === "number" && !nonZeroDefaults.has(key)) expect(value).toBe(0);
    }
  });

  it("has all boolean fields set to false", () => {
    for (const value of Object.values(defaultTalentEffects)) {
      if (typeof value === "boolean") expect(value).toBe(false);
    }
  });

  it("has null thresholds, zero companion bonds, and known non-zero multipliers", () => {
    expect(defaultTalentEffects).toMatchObject({
      healthThresholdBlock: null,
      healthThresholdArmor: null,
      bleedDesperateMultiplier: 1,
      healMultiplier: 1,
    });
    const levels = defaultTalentEffects.companionBondLevels;
    expect(Object.keys(levels).length).toBeGreaterThan(0);
    for (const value of Object.values(levels)) expect(value).toBe(0);
  });
});

describe("defaultBattleState", () => {
  it("returns fresh object each call (no mutation sharing)", () => {
    const a = defaultBattleState();
    const b = defaultBattleState();
    expect(a).not.toBe(b);
    a.playerHealth = 15;
    expect(b.playerHealth).toBe(30);
  });

  it("initializes placeholder combat defaults", () => {
    const s = defaultBattleState();
    expect(s).toMatchObject({
      mana: 0,
      maxMana: 0,
      playerHealth: 30,
      enemyHealth: 30,
      currentEnemy: { id: "skeleton" },
      pendingMaterials: { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 },
      talentEffects: defaultTalentEffects,
      playerStatuses: {
        block: 0,
        armor: 0,
        forge: 0,
        haste: 0,
        burn: 0,
        poison: 0,
        bleed: 0,
        freeze: 0,
        stun: 0,
      },
      enemyStatuses: { burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
    });
    expect(s.rng).toBe(Math.random);
    for (const value of Object.values(s.flags)) {
      if (typeof value === "boolean") expect(value).toBe(false);
      if (typeof value === "number") expect(value).toBe(0);
    }
  });
});

describe("shuffleCards", () => {
  it("returns a new array (not the same reference)", () => {
    const cards = [{ id: "a", title: "A", descriptionLines: [""], art: "", cost: 1, effects: [] }];
    const shuffled = shuffleCards(cards, Math.random);
    expect(shuffled).not.toBe(cards);
  });

  it("does not mutate the original array", () => {
    const cards = [
      {
        id: "a",
        title: "A",
        descriptionLines: [""],
        art: "",
        cost: 1,
        effects: [{ kind: "damage" as const, damageType: "physical" as const, amount: 5 }],
      },
    ];
    const original = [...cards];
    shuffleCards(cards, Math.random);
    expect(cards).toEqual(original);
  });

  it("preserves all cards", () => {
    const cards = [
      { id: "a", title: "A", descriptionLines: [""], art: "", cost: 1, effects: [], uid: 1 },
      { id: "b", title: "B", descriptionLines: [""], art: "", cost: 1, effects: [], uid: 2 },
      { id: "c", title: "C", descriptionLines: [""], art: "", cost: 1, effects: [], uid: 3 },
    ];
    const shuffled = shuffleCards(cards, Math.random);
    expect(shuffled).toHaveLength(3);
    expect(shuffled.map((c) => c.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("handles empty array", () => {
    expect(shuffleCards([], Math.random)).toEqual([]);
  });

  it("handles single-card array", () => {
    const card = { id: "a", title: "A", descriptionLines: [""], art: "", cost: 1, effects: [] };
    expect(shuffleCards([card], Math.random)).toEqual([card]);
  });
});

describe("drawCards — edge cases", () => {
  it("mid-draw reshuffles discard when deck runs out", () => {
    const deck = [makeTestCardWithId("d1")];
    const discard = [makeTestCardWithId("d2"), makeTestCardWithId("d3"), makeTestCardWithId("d4")];
    const result = drawCards(deck, discard, [], 4, 0, Math.random);
    expect(result.hand).toHaveLength(4);
    expect(result.deck).toHaveLength(0);
    expect(result.discard).toHaveLength(0);
    const ids = result.hand.map((c: { id: string }) => c.id).sort();
    expect(ids).toEqual(["d1", "d2", "d3", "d4"]);
  });

  it("both piles empty returns empty hand unchanged", () => {
    const result = drawCards([], [], [], 4, 0, Math.random);
    expect(result.hand).toHaveLength(0);
    expect(result.deck).toHaveLength(0);
    expect(result.discard).toHaveLength(0);
  });

  it("both piles empty with existing hand leaves hand unchanged", () => {
    const hand = [makeTestCardWithId("h1")];
    const result = drawCards([], [], hand, 4, 0, Math.random);
    expect(result.hand).toHaveLength(1);
    expect(result.hand[0].id).toBe("h1");
  });

  it("draws single card from single-card deck with empty discard", () => {
    const deck = [makeTestCardWithId("d1")];
    const result = drawCards(deck, [], [], 1, 0, Math.random);
    expect(result.hand).toHaveLength(1);
    expect(result.hand[0].id).toBe("d1");
    expect(result.deck).toHaveLength(0);
  });

  it("drawing with near-full hand respects MAX_HAND_SIZE", () => {
    const hand = Array.from({ length: 6 }, (_, i) => makeTestCardWithId(`h${i}`));
    const deck = [makeTestCardWithId("d1"), makeTestCardWithId("d2"), makeTestCardWithId("d3")];
    const result = drawCards(deck, [], hand, 4, 0, Math.random);
    expect(result.hand).toHaveLength(7);
    expect(result.deck).toHaveLength(2);
  });

  it("silently skips draws when hand is already at MAX_HAND_SIZE", () => {
    const hand = Array.from({ length: MAX_HAND_SIZE }, (_, i) => makeTestCardWithId(`h${i}`));
    const deck = [makeTestCardWithId("d1"), makeTestCardWithId("d2"), makeTestCardWithId("d3")];
    const result = drawCards(deck, [], hand, 4, 0, Math.random);
    expect(result.hand).toHaveLength(MAX_HAND_SIZE);
    expect(result.deck.map((card) => card.id)).toEqual(["d1", "d2", "d3"]);
  });

  it("drawing 0 cards does nothing", () => {
    const deck = [makeCard("d1")];
    const hand = [makeCard("h1")];
    const result = drawCards(deck, [], hand, 0, 0, Math.random);
    expect(result.hand).toHaveLength(1);
    expect(result.deck).toHaveLength(1);
  });

  it("all drawn cards get unique uids", () => {
    const deck = [makeCard("d1"), makeCard("d2"), makeCard("d3")];
    const result = drawCards(deck, [], [], 3, 100, Math.random);
    const uids = result.hand.map((c) => c.uid!);
    expect(new Set(uids).size).toBe(3);
    expect(uids).toEqual([100, 101, 102]);
  });

  it("uses the provided rng when reshuffling discard into deck", () => {
    const deck = [makeCard("d1")];
    const discard = [makeCard("d2"), makeCard("d3"), makeCard("d4")];
    const alwaysZero = () => 0;
    const alwaysMax = () => 0.999;
    const fromZero = drawCards(deck, discard, [], 4, 0, alwaysZero);
    const fromMax = drawCards(deck, discard, [], 4, 0, alwaysMax);
    expect(fromZero.hand.map((c: { id: string }) => c.id)).not.toEqual(fromMax.hand.map((c: { id: string }) => c.id));
  });
});
