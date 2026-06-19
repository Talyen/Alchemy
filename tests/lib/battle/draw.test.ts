import { describe, expect, it } from "vitest";
import { defaultBattleState, defaultTalentEffects } from "@/lib/battle";
import { drawCards, shuffleCards } from "@/lib/battle/draw";
import { MAX_HAND_SIZE } from "@/lib/game-constants";
import { createEmptyTalentManifest } from "@/lib/game-data";

describe("defaultTalentEffects", () => {
  it("matches the empty talent manifest shape", () => {
    const empty = createEmptyTalentManifest();
    expect(Object.keys(defaultTalentEffects)).toEqual(Object.keys(empty));
  });

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

  it("has healthThresholdBlock set to null", () => {
    expect(defaultTalentEffects.healthThresholdBlock).toBeNull();
  });

  it("has healthThresholdArmor set to null", () => {
    expect(defaultTalentEffects.healthThresholdArmor).toBeNull();
  });

  it("has companionBondLevels with all known companions at 0", () => {
    const levels = defaultTalentEffects.companionBondLevels;
    expect(Object.keys(levels).length).toBeGreaterThan(0);
    for (const value of Object.values(levels)) expect(value).toBe(0);
  });

  it("has bleedDesperateMultiplier set to 1", () => {
    expect(defaultTalentEffects.bleedDesperateMultiplier).toBe(1);
  });

  it("has healMultiplier set to 1", () => {
    expect(defaultTalentEffects.healMultiplier).toBe(1);
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

  it("initializes mana to 0", () => {
    expect(defaultBattleState().mana).toBe(0);
  });

  it("initializes maxMana to 0", () => {
    expect(defaultBattleState().maxMana).toBe(0);
  });

  it("initializes player health to MAX_PLAYER_HEALTH (30)", () => {
    expect(defaultBattleState().playerHealth).toBe(30);
  });

  it("initializes enemy health to BASE_ENEMY_HEALTH (30)", () => {
    expect(defaultBattleState().enemyHealth).toBe(30);
  });

  it("initializes all player statuses to 0", () => {
    const s = defaultBattleState();
    const statusKeys: (keyof typeof s.playerStatuses)[] = [
      "block",
      "armor",
      "forge",
      "haste",
      "burn",
      "poison",
      "bleed",
      "freeze",
      "stun",
    ];
    for (const key of statusKeys) expect(s.playerStatuses[key]).toBe(0);
  });

  it("initializes all enemy statuses to 0", () => {
    const s = defaultBattleState();
    const statusKeys: (keyof typeof s.enemyStatuses)[] = ["burn", "poison", "bleed", "freeze", "stun"];
    for (const key of statusKeys) expect(s.enemyStatuses[key]).toBe(0);
  });

  it("initializes pendingMaterials as empty inventory", () => {
    const s = defaultBattleState();
    expect(s.pendingMaterials).toEqual({ wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 });
  });

  it("uses skeleton as default enemy", () => {
    const s = defaultBattleState();
    expect(s.currentEnemy.id).toBe("skeleton");
  });

  it("sets rng to Math.random", () => {
    expect(defaultBattleState().rng).toBe(Math.random);
  });

  it("initializes flags as all false/0", () => {
    const s = defaultBattleState();
    for (const value of Object.values(s.flags)) {
      if (typeof value === "boolean") expect(value).toBe(false);
      if (typeof value === "number") expect(value).toBe(0);
    }
  });

  it("returns talentEffects as defaultTalentEffects", () => {
    expect(defaultBattleState().talentEffects).toBe(defaultTalentEffects);
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
  function makeCard(id: string) {
    return { id, title: id, descriptionLines: [""], art: "", cost: 1, effects: [] };
  }

  it("mid-draw reshuffles discard when deck runs out", () => {
    const deck = [makeCard("d1")];
    const discard = [makeCard("d2"), makeCard("d3"), makeCard("d4")];
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
    const hand = [makeCard("h1")];
    const result = drawCards([], [], hand, 4, 0, Math.random);
    expect(result.hand).toHaveLength(1);
    expect(result.hand[0].id).toBe("h1");
  });

  it("draws single card from single-card deck with empty discard", () => {
    const deck = [makeCard("d1")];
    const result = drawCards(deck, [], [], 1, 0, Math.random);
    expect(result.hand).toHaveLength(1);
    expect(result.hand[0].id).toBe("d1");
    expect(result.deck).toHaveLength(0);
  });

  it("drawing with near-full hand respects MAX_HAND_SIZE", () => {
    const hand = Array.from({ length: 6 }, (_, i) => makeCard(`h${i}`));
    const deck = [makeCard("d1"), makeCard("d2"), makeCard("d3")];
    const result = drawCards(deck, [], hand, 4, 0, Math.random);
    expect(result.hand).toHaveLength(7);
    expect(result.deck).toHaveLength(2);
  });

  it("silently skips draws when hand is already at MAX_HAND_SIZE", () => {
    const hand = Array.from({ length: MAX_HAND_SIZE }, (_, i) => makeCard(`h${i}`));
    const deck = [makeCard("d1"), makeCard("d2"), makeCard("d3")];
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
