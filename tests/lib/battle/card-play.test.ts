import { describe, expect, it } from "vitest";
import { canPlayCard, cardHasDamageType, playBattleCardResolved } from "@/lib/battle/card-play";
import { defaultBattleState } from "@/lib/battle";
import { companionLibrary } from "@/lib/game-data";
import { makeTestBattleState, makeTestCard, slashDeck } from "../../fixtures/battle";

function makeState(overrides: Parameters<typeof makeTestBattleState>[0] = {}) {
  return makeTestBattleState({ mana: 5, maxMana: 5, ...overrides });
}

describe("cardHasDamageType", () => {
  it("returns true when the card has a matching damage effect", () => {
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "holy", amount: 3 }] });
    expect(cardHasDamageType(card, "holy")).toBe(true);
    expect(cardHasDamageType(card, "physical")).toBe(false);
  });
});

describe("playBattleCardResolved", () => {
  it("deducts mana and removes card from hand", () => {
    const card = slashDeck(1)[0];
    card.cost = 2;
    const state = makeState({ hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.mana).toBe(3);
    expect(result.state.hand).toHaveLength(0);
  });

  it("returns unchanged state when wish is active", () => {
    const card = makeTestCard({ cost: 1 });
    const state = makeState({ wishOptions: [card], hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state).toBe(state);
  });

  it("cannot play a card with insufficient mana", () => {
    const card = makeTestCard({ cost: 1 });
    const state = makeState({ mana: 0, hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state).toBe(state);
  });

  it("can play a 0-cost card with 0 mana", () => {
    const card = makeTestCard({ cost: 0, effects: [{ kind: "damage", damageType: "physical", amount: 1 }] });
    const state = makeState({ mana: 0, enemyHealth: 30, hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.mana).toBe(0);
    expect(result.state.enemyHealth).toBe(29);
  });

  it("restore-mana effect is applied before cost deduction so overflow works", () => {
    const card = makeTestCard({ cost: 1, effects: [{ kind: "restore-mana", amount: 2 }] });
    const state = makeState({ mana: 4, maxMana: 4, hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.mana).toBe(5);
    expect(result.state.maxMana).toBe(4);
  });

  it("restore-mana that equals cost results in no net mana change", () => {
    const card = makeTestCard({ cost: 1, effects: [{ kind: "restore-mana", amount: 1 }] });
    const state = makeState({ mana: 4, maxMana: 4, hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.mana).toBe(4);
    expect(result.state.maxMana).toBe(4);
  });

  it("gain-max-mana with cost applies gain before cost deduction", () => {
    const card = makeTestCard({ cost: 1, effects: [{ kind: "gain-max-mana", amount: 1 }] });
    const state = makeState({ mana: 4, maxMana: 4, hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.maxMana).toBe(5);
    expect(result.state.mana).toBe(4);
  });

  it("uses corrupted card effect values mechanically", () => {
    const card = makeTestCard({
      id: "slash",
      corrupted: true,
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    });
    const state = makeState({ enemyHealth: 30, hand: [card] });
    const result = playBattleCardResolved(state, "slash", 0);
    expect(result.state.enemyHealth).toBe(24);
  });

  it("summons and consumes a companion card", () => {
    const card = makeTestCard({
      id: "wolf-companion",
      consume: true,
      effects: [{ kind: "summon-companion", companionId: "wolf" }],
    });
    const state = makeState({ hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.activeCompanion?.id).toBe("wolf");
    expect(result.state.exhausted).toEqual([card]);
  });

  it("replaces the current companion when another companion is summoned", () => {
    const card = makeTestCard({ id: "wolf-companion", effects: [{ kind: "summon-companion", companionId: "wolf" }] });
    const state = makeState({
      hand: [card],
      activeCompanion: { ...companionLibrary.wolf, title: "Old Wolf" },
    });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.activeCompanion).toEqual(companionLibrary.wolf);
  });
});

describe("playBattleCardResolved — edge cases", () => {
  it("returns state unchanged when enemy health is already 0", () => {
    const state = makeState({ enemyHealth: 0, hand: [makeTestCard({ cost: 1 })] });
    const result = playBattleCardResolved(state, "test-card", 0);
    expect(result.state).toBe(state);
    expect(result.combatTexts).toEqual([]);
  });

  it("returns state unchanged when player is defeated", () => {
    const state = makeState({
      playerHealth: 0,
      deathsDoorUsed: true,
      deathsDoorActive: false,
      hand: [makeTestCard({ cost: 1 })],
    });
    const result = playBattleCardResolved(state, "test-card", 0);
    expect(result.state).toBe(state);
    expect(result.combatTexts).toEqual([]);
  });
});

describe("canPlayCard", () => {
  it("allows affordable cards on the player turn", () => {
    const card = makeTestCard({
      id: "strike",
      cost: 2,
      effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const state = makeState({ mana: 3, hand: [card], turnPhase: "player" });
    expect(canPlayCard(state, card, 0)).toBe(true);
  });

  it("blocks play when mana is insufficient", () => {
    const card = makeTestCard({ cost: 5 });
    const state = makeState({ mana: 2, hand: [card], turnPhase: "player" });
    expect(canPlayCard(state, card, 0)).toBe(false);
  });

  it("blocks play during enemy turn, wish selection, or after defeat", () => {
    const card = makeTestCard({ cost: 1 });
    const base = makeState({ mana: 5, hand: [card] });
    expect(canPlayCard({ ...base, turnPhase: "enemy" }, card, 0)).toBe(false);
    expect(canPlayCard({ ...base, wishOptions: [card] }, card, 0)).toBe(false);
    expect(canPlayCard({ ...base, playerHealth: 0, deathsDoorActive: false }, card, 0)).toBe(false);
    expect(canPlayCard({ ...base, enemyHealth: 0 }, card, 0)).toBe(false);
  });

  it("requires hand index to match card id and uid", () => {
    const handCard = makeTestCard({ id: "a", uid: 1 });
    const otherCard = makeTestCard({ id: "b", uid: 2 });
    const state = makeState({ mana: 5, hand: [handCard], turnPhase: "player" });
    expect(canPlayCard(state, handCard, 0)).toBe(true);
    expect(canPlayCard(state, otherCard, 0)).toBe(false);
  });

  it("matches defaultBattleState mana baseline used by headless sim", () => {
    const card = makeTestCard({ cost: 1 });
    const state = { ...defaultBattleState(), hand: [card], turnPhase: "player" as const, mana: 0 };
    expect(canPlayCard(state, card, 0)).toBe(false);
  });
});
