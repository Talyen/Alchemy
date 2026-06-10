import { describe, expect, it, vi } from "vitest";
import { makeState, makeCard } from "./helpers";

vi.spyOn(Math, "random").mockReturnValue(0.99);
import { applyCardEffects, chooseWishCard, defaultTalentEffects, processCompanionTurnStart } from "@/lib/battle";
import { drawCards, shuffleCards } from "@/lib/battle/draw";
import { type CombatTextEvent } from "@/lib/battle/types";
import { MAX_HAND_SIZE } from "@/lib/game-constants";
import { companionLibrary } from "@/lib/game-data";

describe("processCompanionTurnStart", () => {
  it("triggers Wolf companion bleed damage", () => {
    const state = makeState({
      activeCompanion: companionLibrary.wolf,
      enemyAttackEffects: [],
    });

    const texts: CombatTextEvent[] = [];
    const result = processCompanionTurnStart(state, texts);

    expect(result.enemyHealth).toBe(29);
    expect(result.enemyStatuses.bleed).toBe(2);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "bleed", amount: 1 });
  });

  it("applies player modifiers to companion attacks", () => {
    const state = makeState({
      activeCompanion: companionLibrary.wolf,
      enemyAttackEffects: [],
      playerHealth: 10,
      talentEffects: { ...defaultTalentEffects, bleedDesperateMultiplier: 2 },
    });

    const texts: CombatTextEvent[] = [];
    const result = processCompanionTurnStart(state, texts);

    expect(result.enemyHealth).toBe(28);
    expect(result.enemyStatuses.bleed).toBe(4);
  });

  it("triggers Lizard Scout companion poison damage", () => {
    const state = makeState({
      activeCompanion: companionLibrary["lizard-scout"],
      enemyAttackEffects: [],
    });

    const texts: CombatTextEvent[] = [];
    const result = processCompanionTurnStart(state, texts);

    expect(result.enemyHealth).toBe(29);
    expect(result.enemyStatuses.poison).toBe(1);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "poison", amount: 1 });
  });

  it("triggers Imp companion burn damage", () => {
    const state = makeState({
      activeCompanion: companionLibrary.imp,
      enemyAttackEffects: [],
    });

    const texts: CombatTextEvent[] = [];
    const result = processCompanionTurnStart(state, texts);

    expect(result.enemyHealth).toBe(29);
    expect(result.enemyStatuses.burn).toBe(1);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "burn", amount: 1 });
  });

  it("applies only the active companion's bond level", () => {
    const wolfState = makeState({
      activeCompanion: companionLibrary.wolf,
      enemyAttackEffects: [],
      talentEffects: {
        ...defaultTalentEffects,
        companionBondLevels: { ...defaultTalentEffects.companionBondLevels, wolf: 2 },
      },
    });
    const impState = makeState({
      activeCompanion: companionLibrary.imp,
      enemyAttackEffects: [],
      talentEffects: {
        ...defaultTalentEffects,
        companionBondLevels: { ...defaultTalentEffects.companionBondLevels, wolf: 2 },
      },
    });

    const wolfResult = processCompanionTurnStart(wolfState, []);
    const impResult = processCompanionTurnStart(impState, []);

    expect(wolfResult.enemyHealth).toBe(27);
    expect(impResult.enemyHealth).toBe(29);
  });

  it("returns state unchanged when no active companion", () => {
    const state = makeState();

    const texts: CombatTextEvent[] = [];
    const result = processCompanionTurnStart(state, texts);

    expect(result).toBe(state);
    expect(texts).toHaveLength(0);
  });
});

describe("chooseWishCard", () => {
  it("adds chosen card to hand if there's room", () => {
    const card = makeCard({ id: "wish-card" });
    const state = makeState({ hand: [], wishOptions: [card] });
    const result = chooseWishCard(state, "wish-card");
    expect(result.hand).toHaveLength(1);
    expect(result.hand[0].id).toBe("wish-card");
    expect(result.wishOptions).toBeNull();
    expect(result.wishQueue).toEqual([]);
  });

  it("puts card in discard if hand is full", () => {
    const card = makeCard({ id: "wish-card" });
    const fullHand = Array(7)
      .fill(null)
      .map((_, i) => makeCard({ id: `h${i}` }));
    const state = makeState({ hand: fullHand, wishOptions: [card] });
    const result = chooseWishCard(state, "wish-card");
    expect(result.discard).toHaveLength(1);
    expect(result.discard[0].id).toBe("wish-card");
    expect(result.wishOptions).toBeNull();
    expect(result.wishQueue).toEqual([]);
  });

  it("opens the next queued Wish after choosing a card", () => {
    const firstCard = makeCard({ id: "first-wish-card" });
    const secondCard = makeCard({ id: "second-wish-card" });
    const state = makeState({ hand: [], wishOptions: [firstCard], wishQueue: [[secondCard]] });

    const firstChoice = chooseWishCard(state, "first-wish-card");
    expect(firstChoice.hand.map((card) => card.id)).toEqual(["first-wish-card"]);
    expect(firstChoice.wishOptions).toEqual([secondCard]);
    expect(firstChoice.wishQueue).toEqual([]);

    const secondChoice = chooseWishCard(firstChoice, "second-wish-card");
    expect(secondChoice.hand.map((card) => card.id)).toEqual(["first-wish-card", "second-wish-card"]);
    expect(secondChoice.wishOptions).toBeNull();
    expect(secondChoice.wishQueue).toEqual([]);
  });
});

describe("wish combat effects", () => {
  it("applies the Gold-tree gold on Wish talent", () => {
    const card = makeCard({ effects: [{ kind: "wish", amount: 1 }] });
    const state = makeState({
      gold: 2,
      talentEffects: { ...defaultTalentEffects, goldOnWish: 3 },
    });
    const texts: CombatTextEvent[] = [];

    const result = applyCardEffects(state, card, texts);

    expect(result.gold).toBe(5);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 3 });
  });

  it("queues one choice per Wish amount", () => {
    const card = makeCard({ effects: [{ kind: "wish", amount: 2 }] });
    const state = makeState();
    const texts: CombatTextEvent[] = [];

    const result = applyCardEffects(state, card, texts);

    expect(result.wishOptions).toHaveLength(3);
    expect(result.wishQueue).toHaveLength(1);
    expect(result.wishQueue[0]).toHaveLength(3);
  });

  it("applies on-Wish rewards once per Wish amount", () => {
    const card = makeCard({ effects: [{ kind: "wish", amount: 2 }] });
    const state = makeState({
      gold: 2,
      talentEffects: { ...defaultTalentEffects, goldOnWish: 3, healthOnWish: 2 },
      playerHealth: 20,
    });
    const texts: CombatTextEvent[] = [];

    const result = applyCardEffects(state, card, texts);

    expect(result.gold).toBe(8);
    expect(result.playerHealth).toBe(24);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 6 });
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 4 });
  });
});

describe("drawCards", () => {
  it("draws the requested number of cards", () => {
    const deck = [makeCard({ id: "a" }), makeCard({ id: "b" }), makeCard({ id: "c" })];
    const result = drawCards(deck, [], [], 2);
    expect(result.hand).toHaveLength(2);
    expect(result.deck).toHaveLength(1);
  });

  it("respects MAX_HAND_SIZE", () => {
    const deck = Array(10)
      .fill(null)
      .map((_, i) => makeCard({ id: `c${i}` }));
    const result = drawCards(
      deck,
      [],
      Array(6)
        .fill(null)
        .map((_, i) => makeCard({ id: `h${i}` })),
      10,
    );
    expect(result.hand).toHaveLength(MAX_HAND_SIZE);
  });

  it("reshuffles discard into deck when deck is empty", () => {
    const discard = [makeCard({ id: "a" }), makeCard({ id: "b" })];
    const result = drawCards([], discard, [], 2);
    expect(result.hand).toHaveLength(2);
    expect(result.discard).toHaveLength(0);
  });
});

describe("shuffleCards", () => {
  it("returns all cards in a shuffled order", () => {
    const cards = [makeCard({ id: "a" }), makeCard({ id: "b" }), makeCard({ id: "c" })];
    const result = shuffleCards(cards);
    expect(result).toHaveLength(3);
    expect(result).toEqual(expect.arrayContaining(cards));
  });

  it("does not mutate the original array", () => {
    const cards = [makeCard({ id: "a" }), makeCard({ id: "b" })];
    const result = shuffleCards(cards);
    expect(cards).toHaveLength(2);
    expect(result).not.toBe(cards);
  });
});

describe("chooseWishCard — edge cases", () => {
  it("returns state unchanged when card id is not in wishOptions", () => {
    const state = makeState({ wishOptions: [makeCard({ id: "real-card" })] });
    const result = chooseWishCard(state, "nonexistent-card");
    expect(result).toBe(state);
  });

  it("skips wish and clears wishOptions when called with null and no queue", () => {
    const state = makeState({ wishOptions: [makeCard({ id: "card" })], wishQueue: [] });
    const result = chooseWishCard(state, null);
    expect(result.wishOptions).toBeNull();
    expect(result.wishQueue).toEqual([]);
    expect(result.hand).toHaveLength(0);
    expect(result.discard).toHaveLength(0);
  });

  it("skips wish and opens next queued wish when called with null", () => {
    const nextCard = makeCard({ id: "next-card" });
    const state = makeState({ wishOptions: [makeCard({ id: "current" })], wishQueue: [[nextCard]] });
    const result = chooseWishCard(state, null);
    expect(result.wishOptions).toEqual([nextCard]);
    expect(result.wishQueue).toEqual([]);
    expect(result.hand).toHaveLength(0);
    expect(result.discard).toHaveLength(0);
  });

  it("skips through multiple wishes in queue sequentially with null", () => {
    const firstCard = makeCard({ id: "first" });
    const secondCard = makeCard({ id: "second" });
    const state = makeState({ wishOptions: [makeCard({ id: "current" })], wishQueue: [[firstCard], [secondCard]] });
    const firstSkip = chooseWishCard(state, null);
    expect(firstSkip.wishOptions).toEqual([firstCard]);
    expect(firstSkip.wishQueue).toHaveLength(1);
    const secondSkip = chooseWishCard(firstSkip, null);
    expect(secondSkip.wishOptions).toEqual([secondCard]);
    expect(secondSkip.wishQueue).toHaveLength(0);
    const thirdSkip = chooseWishCard(secondSkip, null);
    expect(thirdSkip.wishOptions).toBeNull();
    expect(thirdSkip.wishQueue).toHaveLength(0);
    expect(thirdSkip.hand).toHaveLength(0);
  });
});


