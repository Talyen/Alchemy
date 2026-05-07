import { describe, expect, it, vi } from "vitest";
import { mergeCombatText, applyCardEffects } from "@/lib/battle/effects";
import { playBattleCardResolved, endPlayerTurn, chooseWishCard } from "@/lib/battle/turns";
import { drawCards, createBattleState, defaultTalentEffects, shuffleCards } from "@/lib/battle/draw";
import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "@/lib/battle/types";
import { basePlayerMana, clamp, clampHealth, maxHandSize, maxPlayerHealth } from "@/lib/battle/types";

const mathRandomSpy = vi.spyOn(Math, "random").mockReturnValue(0.99);

function makeState(overrides: Partial<BattleState> = {}): BattleState {
  const empty: BattleState = {
    deck: [], hand: [], discard: [], exhausted: [], mana: 0, maxMana: 0, gold: 0,
    turn: 1, turnPhase: "player", playerHealth: 30, playerMaxHealth: 30, enemyHealth: 30,
    enemyMaxHealth: 30, enemyAttackEffects: [], enemyArmor: 0, enemyRegeneration: 0,
    playerStatuses: { block: 0, armor: 0, forge: 0, haste: 0, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
    enemyStatuses: { burn: 0, poison: 0, bleed: 0, bleedLeech: 0, freeze: 0, stun: 0 },
    enemyStunSkipTurns: 0, enemyFreezeSkipTurns: 0, wishOptions: null,
    currentEnemy: { id: "skeleton", title: "Skeleton", subtitle: "", descriptionLines: [""], art: "", enemyType: "normal", traits: [], attackEffects: [] },
    talentEffects: defaultTalentEffects,
    flags: {
      firstPhysicalCardFreeUsed: false,
      firstHolyCardFreeUsed: false,
      firstBurnCardDoubledUsed: false,
      firstArmorCardDoubledUsed: false,
      firstPoisonCardFreeUsed: false,
      firstBleedCardFreeUsed: false,
      nextCardCostReduction: 0,
      goldOnFirstPoisonThisCombat: false,
    },
    discoveredCardIds: [],
  };
  return { ...empty, ...overrides };
}

function makeCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return {
    id: "test-card", title: "Test", descriptionLines: [""], art: "",
    cost: 1, template: "mechanical", effects: [], ...overrides,
  };
}

// ─── effects.ts ───

describe("mergeCombatText", () => {
  it("adds a new event to an empty array", () => {
    const texts: CombatTextEvent[] = [];
    mergeCombatText(texts, { target: "enemy", kind: "damage", stat: "physical", amount: 5 });
    expect(texts).toEqual([{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }]);
  });

  it("merges events with the same target, kind, and stat", () => {
    const texts: CombatTextEvent[] = [{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }];
    mergeCombatText(texts, { target: "enemy", kind: "damage", stat: "physical", amount: 3 });
    expect(texts).toEqual([{ target: "enemy", kind: "damage", stat: "physical", amount: 8 }]);
  });

  it("does NOT merge events with different targets", () => {
    const texts: CombatTextEvent[] = [{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }];
    mergeCombatText(texts, { target: "player", kind: "damage", stat: "physical", amount: 3 });
    expect(texts).toHaveLength(2);
  });

  it("does NOT merge events with different stats", () => {
    const texts: CombatTextEvent[] = [{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }];
    mergeCombatText(texts, { target: "enemy", kind: "damage", stat: "burn", amount: 3 });
    expect(texts).toHaveLength(2);
  });
});

describe("applyCardEffects", () => {
  it("applies damage to enemy health", () => {
    const state = makeState({ mana: 10, enemyHealth: 30 });
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(25);
  });

  it("applies player block status", () => {
    const state = makeState({ mana: 10 });
    const card = makeCard({ effects: [{ kind: "player-status", status: "block", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.playerStatuses.block).toBe(5);
  });

  it("heals the player", () => {
    const state = makeState({ mana: 10, playerHealth: 20 });
    const card = makeCard({ effects: [{ kind: "heal", amount: 5 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.playerHealth).toBe(25);
  });

  it("restores mana", () => {
    const state = makeState({ mana: 2, maxMana: 4 });
    const card = makeCard({ effects: [{ kind: "restore-mana", amount: 2 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.mana).toBe(4);
  });

  it("restore-mana can overflow maxMana", () => {
    const state = makeState({ mana: 4, maxMana: 4 });
    const card = makeCard({ effects: [{ kind: "restore-mana", amount: 2 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.mana).toBe(6);
  });

  it("clamps current mana when max mana is reduced", () => {
    const state = makeState({ mana: 4, maxMana: 4 });
    const card = makeCard({ effects: [{ kind: "lose-max-mana", amount: 2 }] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.maxMana).toBe(2);
    expect(result.mana).toBe(2);
  });

  it("handles consume cards (exhaust instead of discard)", () => {
    const state = makeState({ mana: 10 });
    const card = makeCard({ id: "consumable", consume: true, effects: [{ kind: "damage", damageType: "physical", amount: 5 }] });
    const result = playBattleCardResolved(state, "consumable", 0);
    // Also check that the card went to exhausted
    // playBattleCardResolved puts the card in exhausted if consume is true
    // hand starts empty so index 0 doesn't exist, let's use a proper test
    const stateWithHand = makeState({ mana: 10, hand: [card] });
    const r2 = playBattleCardResolved(stateWithHand, "consumable", 0);
    expect(r2.state.hand).toHaveLength(0);
    expect(r2.state.exhausted).toHaveLength(1);
    expect(r2.state.exhausted[0].id).toBe("consumable");
  });
});

// ─── turns.ts ───

describe("playBattleCardResolved", () => {
  it("deducts mana and removes card from hand", () => {
    const card = makeCard({ cost: 2 });
    const state = makeState({ mana: 5, hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.mana).toBe(3);
    expect(result.state.hand).toHaveLength(0);
  });

  it("returns unchanged state when mana is 0", () => {
    const card = makeCard({ cost: 1 });
    const state = makeState({ mana: 0, hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state).toBe(state);
  });

  it("returns unchanged state when wish is active", () => {
    const card = makeCard({ cost: 1 });
    const state = makeState({ mana: 5, wishOptions: [card], hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state).toBe(state);
  });

  it("deals damage from card effects", () => {
    const card = makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 7 }] });
    const state = makeState({ mana: 5, enemyHealth: 30, hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.enemyHealth).toBe(23);
  });

  it("cannot play a card that costs more than available mana", () => {
    const card = makeCard({ cost: 3 });
    const state = makeState({ mana: 2, hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state).toBe(state);
  });

  it("can play a 0-cost card with 0 mana", () => {
    const card = makeCard({ cost: 0, effects: [{ kind: "damage", damageType: "physical", amount: 1 }] });
    const state = makeState({ mana: 0, hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.mana).toBe(0);
    expect(result.state.hand).toHaveLength(0);
    expect(result.state.enemyHealth).toBe(29);
  });

  it("can spend overflow mana when above maxMana", () => {
    const cheapCard = makeCard({ cost: 1, effects: [{ kind: "damage", damageType: "physical", amount: 1 }] });
    const state = makeState({ mana: 6, maxMana: 4, hand: [cheapCard] });
    const result = playBattleCardResolved(state, cheapCard.id, 0);
    expect(result.state.mana).toBe(5);
    expect(result.state.enemyHealth).toBe(29);
  });
});

describe("endPlayerTurn", () => {
  it("switches to enemy phase and draws a new hand", () => {
    const state = makeState({ mana: 4, maxMana: 4, turnPhase: "player", hand: [makeCard({ id: "c1" }), makeCard({ id: "c2" })], deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })] });
    const result = endPlayerTurn(state);
    expect(result.state.turnPhase).toBe("player");
    expect(result.state.turn).toBe(2);
    expect(result.state.hand.length).toBeGreaterThanOrEqual(1);
    expect(result.state.mana).toBe(4);
  });

  it("skips enemy turn when enemyStunSkipTurns > 0", () => {
    const state = makeState({ enemyStunSkipTurns: 1, deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })], mana: 4, maxMana: 4 });
    const result = endPlayerTurn(state);
    expect(result.state.enemyStunSkipTurns).toBe(0);
    expect(result.state.playerHealth).toBe(30); // no damage taken
  });

  it("applies enemy attack damage", () => {
    const state = makeState({ enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }], playerHealth: 30, deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })], mana: 4, maxMana: 4 });
    const result = endPlayerTurn(state);
    // With no block or armor, all 8 damage goes through
    expect(result.state.playerHealth).toBe(22);
  });

  it("gives the player an extra turn when haste is active", () => {
    const state = makeState({
      playerStatuses: { block: 0, armor: 0, forge: 0, haste: 1, burn: 0, poison: 0, bleed: 0, freeze: 0, stun: 0 },
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      hand: [makeCard({ id: "h1" }), makeCard({ id: "h2" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    expect(result.state.turnPhase).toBe("player");
    expect(result.state.playerStatuses.haste).toBe(0);
    // Enemy should not have attacked
    expect(result.state.playerHealth).toBe(30);
  });

  it("only heals leech amount from bleed, not total bleed stack", () => {
    const state = makeState({
      playerHealth: 20,
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
      enemyStatuses: { burn: 0, poison: 0, bleed: 10, bleedLeech: 4, freeze: 0, stun: 0 },
      deck: [makeCard({ id: "d1" }), makeCard({ id: "d2" }), makeCard({ id: "d3" }), makeCard({ id: "d4" })],
      mana: 4,
      maxMana: 4,
    });
    const result = endPlayerTurn(state);
    // Enemy takes 10 bleed damage
    expect(result.state.enemyHealth).toBe(20);
    // Player takes 8 enemy attack then heals 4 from leech: 20 - 8 + 4 = 16
    expect(result.state.playerHealth).toBe(16);
    expect(result.state.enemyStatuses.bleed).toBe(0);
    expect(result.state.enemyStatuses.bleedLeech).toBe(0);
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
  });

  it("puts card in discard if hand is full", () => {
    const card = makeCard({ id: "wish-card" });
    const fullHand = Array(7).fill(null).map((_, i) => makeCard({ id: `h${i}` }));
    const state = makeState({ hand: fullHand, wishOptions: [card] });
    const result = chooseWishCard(state, "wish-card");
    expect(result.discard).toContainEqual(card);
    expect(result.wishOptions).toBeNull();
  });
});

// ─── draw.ts ───

describe("drawCards", () => {
  it("draws the requested number of cards", () => {
    const deck = [makeCard({ id: "a" }), makeCard({ id: "b" }), makeCard({ id: "c" })];
    const result = drawCards(deck, [], [], 2);
    expect(result.hand).toHaveLength(2);
    expect(result.deck).toHaveLength(1);
  });

  it("respects maxHandSize", () => {
    const deck = Array(10).fill(null).map((_, i) => makeCard({ id: `c${i}` }));
    const result = drawCards(deck, [], Array(6).fill(null).map((_, i) => makeCard({ id: `h${i}` })), 10);
    expect(result.hand).toHaveLength(maxHandSize);
  });

  it("reshuffles discard into deck when deck is empty", () => {
    const discard = [makeCard({ id: "a" }), makeCard({ id: "b" })];
    const result = drawCards([], discard, [], 2);
    expect(result.hand).toHaveLength(2);
    expect(result.discard).toHaveLength(0);
  });
});

describe("createBattleState", () => {
  it("creates a valid battle state with starting hand", () => {
    const result = createBattleState();
    expect(result.turn).toBe(1);
    expect(result.playerHealth).toBe(maxPlayerHealth);
    expect(result.enemyHealth).toBe(30);
    expect(result.hand.length).toBeGreaterThanOrEqual(1);
    expect(result.mana).toBe(basePlayerMana);
  });

  it("scales enemy stats based on rooms encountered", () => {
    const result = createBattleState(undefined, 0, 5); // room 5 → 40% boost
    expect(result.enemyHealth).toBe(42); // 30 * 1.4 = 42
    expect(result.enemyAttackEffects[0].amount).toBe(11); // 8 * 1.4 = 11.2 → floor 11
  });
});

describe("clamp / clampHealth", () => {
  it("clamps value between min and max", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("clampHealth adds positive delta clamped to max", () => {
    expect(clampHealth(20, 5, 30)).toBe(25);
    expect(clampHealth(28, 5, 30)).toBe(30);
  });

  it("clampHealth subtracts negative delta clamped to 0", () => {
    expect(clampHealth(10, -5, 30)).toBe(5);
    expect(clampHealth(3, -5, 30)).toBe(0);
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
