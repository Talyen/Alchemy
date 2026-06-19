import { describe, expect, it } from "vitest";
import { cardHasDamageType, playBattleCardResolved } from "@/lib/battle/card-play";
import { companionLibrary } from "@/lib/game-data";
import { POTION_CARD_ID_SUFFIX } from "@/lib/game-constants";
import { defaultTrinketEffects } from "@/lib/trinkets";
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

  it("makes first physical card free when talent is active", () => {
    const card = makeTestCard({
      cost: 2,
      effects: [{ kind: "damage", damageType: "physical", amount: 1 }],
    });
    const state = makeState({
      hand: [
        card,
        makeTestCard({ id: "second", cost: 2, effects: [{ kind: "damage", damageType: "physical", amount: 1 }] }),
      ],
      flags: {
        ...makeState().flags,
        firstPhysicalCardFreeUsed: false,
      },
      talentEffects: {
        ...makeState().talentEffects,
        firstPhysicalCardFree: true,
      },
    });
    const first = playBattleCardResolved(state, card.id, 0);
    expect(first.state.mana).toBe(5);
    expect(first.state.flags.firstPhysicalCardFreeUsed).toBe(true);
    const second = playBattleCardResolved(first.state, "second", 0);
    expect(second.state.mana).toBe(3);
  });

  it("makes first potion free with mortar and pestle boon", () => {
    const card = makeTestCard({
      id: `healing${POTION_CARD_ID_SUFFIX}`,
      cost: 2,
      effects: [{ kind: "heal", amount: 5 }],
    });
    const state = makeState({
      hand: [card],
      trinketEffects: { ...defaultTrinketEffects, mortarPestleFreeFirstPotion: true },
    });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.mana).toBe(5);
    expect(result.state.flags.firstPotionFreeUsed).toBe(true);
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
