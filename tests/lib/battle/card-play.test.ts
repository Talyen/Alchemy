import { describe, expect, it } from "vitest";
import { canPlayCard, playBattleCardResolved } from "@/lib/battle/card-play";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { cardById, companionLibrary } from "@/lib/game-data";
import { makeState as makeSharedState, makeTestCard, slashDeck, type BattleStatePatch } from "../../fixtures/battle";

function makeState(overrides: BattleStatePatch = {}) {
  return makeSharedState({ mana: 5, maxMana: 5, ...overrides });
}

it.each<[string, BattleStatePatch]>([
  ["insufficient Mana", { mana: 0 }],
  ["enemy turn", { turnPhase: "enemy" }],
  ["pending Wish", { wishOptions: [makeTestCard()] }],
  ["Stun", { playerCC: { stunSkipTurns: 1 } }],
  ["Freeze", { playerCC: { freezeSkipTurns: 1 } }],
  ["victory", { enemyHealth: 0 }],
  ["defeat", { playerHealth: 0, deathsDoorUsed: true, deathsDoorActive: false }],
])("rejects play during %s without spending or publishing feedback", (_reason, patch) => {
  const card = makeTestCard({ cost: 1 });
  const state = makeState({ ...patch, hand: [card] });
  expect(canPlayCard(state, card, 0)).toBe(false);
  const result = playBattleCardResolved(state, card.id, 0);
  expect(result.state).toBe(state);
  expect(result.combatTexts).toEqual([]);
});

it("requires the offered hand position, card ID, and UID to match", () => {
  const card = makeTestCard({ id: "strike", uid: 1 });
  const state = makeState({ hand: [card] });
  expect(canPlayCard(state, card, 0)).toBe(true);
  expect(canPlayCard(state, card, 1)).toBe(false);
  expect(canPlayCard(state, { ...card, id: "other" }, 0)).toBe(false);
  expect(canPlayCard(state, { ...card, uid: 2 }, 0)).toBe(false);
});

it.each([
  { cost: 2, mana: 5, remaining: 3 },
  { cost: 0, mana: 0, remaining: 0 },
])("pays $cost Mana once and moves the played card to discard", ({ cost, mana, remaining }) => {
  const card = makeTestCard({
    id: "slash",
    corrupted: true,
    cost,
    effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
  });
  const state = makeState({ hand: [card], mana, rng: () => 0.99 });
  const result = playBattleCardResolved(state, card.id, 0).state;
  expect(result.mana).toBe(remaining);
  expect(result.hand).toEqual([]);
  expect(result.discard).toEqual([card]);
  expect(result.enemyHealth).toBe(24);
  expect(state.hand).toEqual([card]);
  expect(state.mana).toBe(mana);
});

it("pays before a capped Mana refund and applies crystal gains to both Mana values", () => {
  for (const [effect, mana, maxMana] of [
    [{ kind: "restore-mana", amount: 2 }, 4, 4],
    [{ kind: "gain-max-mana", amount: 1 }, 4, 5],
  ] as const) {
    const card = makeTestCard({ cost: 1, effects: [effect] });
    const state = makeState({ mana: 4, maxMana: 4, hand: [card] });
    expect(playBattleCardResolved(state, card.id, 0).state).toMatchObject({ mana, maxMana });
  }
});

it("converts pre-payment Mana when a conversion card is discounted", () => {
  const card = makeTestCard({
    cost: 1,
    effects: [{ kind: "player-status", status: "block", amount: 0, convertCurrentMana: 5 }],
  });
  const state = makeState({ mana: 3, hand: [card], flags: { nextCardCostReduction: 1 } });
  const result = playBattleCardResolved(state, card.id, 0).state;
  expect(result.mana).toBe(0);
  expect(result.playerStatuses.block).toBe(15);
});

it("keeps next-hit Poison through a failed chance and spends it on only the first actual packet", () => {
  const uncertain = makeTestCard({
    id: "uncertain",
    effects: [
      {
        kind: "chance",
        probability: 0.5,
        successEffects: [{ kind: "damage", damageType: "physical", amount: 2 }],
        failureEffects: [{ kind: "heal", amount: 1 }],
      },
    ],
  });
  const attack = makeTestCard({
    id: "two-hits",
    effects: [
      { kind: "damage", damageType: "physical", amount: 2 },
      { kind: "damage", damageType: "physical", amount: 2 },
    ],
  });
  const state = makeState({ hand: [uncertain, attack], rng: () => 0.99, flags: { nextHitPoison: true } });
  const missed = playBattleCardResolved(state, uncertain.id, 0).state;
  expect(missed.flags.nextHitPoison).toBe(true);
  const result = playBattleCardResolved(missed, attack.id, 0);
  expect(result.state.enemyStatuses.poison).toBe(2);
  expect(result.state.flags.nextHitPoison).toBe(false);
  expect(result.combatTexts.filter((text) => text.kind === "damage").map((text) => text.stat)).toEqual([
    "poison",
    "physical",
  ]);
});

it("awards Consume rewards only to consumables while summons replace the Companion and leave the battle", () => {
  const potion = makeTestCard({ id: "apple", consume: true, effects: [{ kind: "heal", amount: 2 }] });
  const summon = cardById["wolf-companion"]!;
  const patch: BattleStatePatch = {
    playerHealth: 10,
    playerMaxHealth: 30,
    rng: () => 0.99,
    activeCompanion: companionLibrary.bear,
    deck: [makeTestCard({ id: "drawn" })],
    talentEffects: {
      healOnConsume: 1,
      goldOnConsume: 1,
      goldOnConsumeChance: 100,
      drawOnConsume: 1,
      drawOnConsumeChance: 100,
    },
  };
  const consumed = playBattleCardResolved(makeState({ ...patch, hand: [potion] }), potion.id, 0).state;
  expect(consumed).toMatchObject({ gold: 1, playerHealth: 13, exhausted: [potion] });
  expect(consumed.hand.map((card) => card.id)).toEqual(["drawn"]);
  const summoned = playBattleCardResolved(makeState({ ...patch, hand: [summon] }), summon.id, 0).state;
  expect(summoned).toMatchObject({
    gold: 0,
    playerHealth: 10,
    activeCompanion: companionLibrary.wolf,
    exhausted: [summon],
    hand: [],
  });
  expect(summoned.deck.map((card) => card.id)).toEqual(["drawn"]);
});

it("holds Resonant Chime at full Mana and grants it only once after Mana is spent", () => {
  const card = makeTestCard({ cost: 0, effects: [] });
  const state = makeState({
    mana: 3,
    maxMana: 3,
    hand: [card],
    cardsPlayedThisTurn: 2,
    trinketEffects: { resonantChimeCardsRequired: 3, resonantChimeMana: 1 },
  });
  const full = playBattleCardResolved(state, card.id, 0).state;
  expect(full.mana).toBe(3);
  expect(full.flags.resonantChimeUsedThisTurn).toBe(false);
  const restored = playBattleCardResolved({ ...full, mana: 1, hand: [card, card] }, card.id, 0).state;
  expect(restored.mana).toBe(2);
  expect(restored.flags.resonantChimeUsedThisTurn).toBe(true);
  expect(playBattleCardResolved(restored, card.id, 0).state.mana).toBe(2);
});

it("permits explicit victory-grace plays and still pays and discards", () => {
  const card = makeTestCard({ cost: 1 });
  const result = playBattleCardResolved(makeState({ enemyHealth: 0, hand: [card], mana: 3 }), card.id, 0, {
    allowAfterEnemyDefeat: true,
  }).state;
  expect(result).toMatchObject({ hand: [], discard: [card], mana: 2 });
});

it("rejects an ineffective cleanse without spending, but allows a mixed-purpose cleanse", () => {
  const card = makeTestCard({ effects: [{ kind: "remove-harmful-status", amount: 1 }] });
  const state = makeState({ hand: [card] });
  expect(canPlayCard(state, card, 0)).toBe(false);
  expect(playBattleCardResolved(state, card.id, 0).state).toBe(state);
  const healing = { ...card, effects: [...card.effects, { kind: "heal", amount: 4 } as const] };
  const result = playBattleCardResolved(makeState({ hand: [healing], playerHealth: 20 }), healing.id, 0).state;
  expect(result.playerHealth).toBe(24);
  expect(result.hand).toEqual([]);
});

describe("reusable evasion", () => {
  it("Feint returns through the draw cycle and evades one attack per play without Consume rewards", () => {
    const card = cardById.feint!;
    let state = makeState({
      hand: [card],
      deck: [cardById.slash!],
      rng: () => 0.99,
      talentEffects: { forgeOnConsume: 3, forgeOnConsumeChance: 100 },
    });
    for (let play = 0; play < 2; play += 1) {
      const index = state.hand.findIndex((entry) => entry.id === card.id);
      const before = state;
      state = playBattleCardResolved(state, card.id, index).state;
      expect(state.mana).toBe(before.mana - 1);
      expect(state.hand.map((entry) => entry.id)).toEqual(["slash"]);
      expect(state.discard).toContainEqual(expect.objectContaining({ id: "feint" }));
      expect(state.exhausted).not.toContainEqual(expect.objectContaining({ id: "feint" }));
      expect(state.playerStatuses.forge).toBe(0);
      const dodged = applyEnemyAbility(state, cardById.slash!, []);
      expect(dodged.playerHealth).toBe(state.playerHealth);
      expect(dodged.flags.dodgeNextAttack).toBe(false);
      const hit = applyEnemyAbility(dodged, cardById.slash!, []);
      expect(hit.playerHealth).toBeLessThan(dodged.playerHealth);
      state = advanceToPlayerTurn(hit);
    }
  });

  it("Shadowstep doubles Feint's draw without stacking evasion", () => {
    const shadowstep = cardById.shadowstep!;
    const feint = cardById.feint!;
    const initial = makeState({ hand: [shadowstep, feint], deck: slashDeck(2) });
    const shadowed = playBattleCardResolved(initial, shadowstep.id, 0).state;
    expect(shadowed.exhausted).toContainEqual(expect.objectContaining({ id: "shadowstep" }));
    const result = playBattleCardResolved(shadowed, feint.id, 0).state;
    expect(result.hand).toHaveLength(2);
    expect(result.flags.playNextCardTwice).toBe(false);
    expect(result.flags.dodgeNextAttack).toBe(true);
    expect(result.discard).toContainEqual(expect.objectContaining({ id: "feint" }));
    expect(result.exhausted).not.toContainEqual(expect.objectContaining({ id: "feint" }));
    const dodged = applyEnemyAbility({ ...result, rng: () => 0.99 }, cardById.slash!, []);
    expect(dodged.playerHealth).toBe(result.playerHealth);
    expect(dodged.flags.dodgeNextAttack).toBe(false);
    expect(applyEnemyAbility(dodged, cardById.slash!, []).playerHealth).toBeLessThan(dodged.playerHealth);
  });
});
