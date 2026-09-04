import { describe, expect, it } from "vitest";
import {
  canPlayCard,
  enemyAttackDealsDamage,
  hasDamageEffect,
  isAttackCard,
  playBattleCardResolved,
} from "@/lib/battle/card-play";
import { cardHasDamageType } from "@/lib/battle/card-cost-rules";
import { defaultBattleState } from "@/lib/battle";
import { cardById, companionLibrary } from "@/lib/game-data";
import { makeState as makeSharedState, makeTestCard, slashDeck } from "../../fixtures/battle";

function makeState(overrides: Parameters<typeof makeSharedState>[0] = {}) {
  return makeSharedState({ mana: 5, maxMana: 5, ...overrides });
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

  it("cannot play a card when player is crowd controlled", () => {
    const card = makeTestCard({ cost: 1, effects: [{ kind: "damage", damageType: "physical", amount: 2 }] });
    const stunnedState = makeState({
      mana: 2,
      hand: [card],
      playerCC: { stunSkipTurns: 1, freezeSkipTurns: 0, cooldown: 0 },
    });
    expect(canPlayCard(stunnedState, card, 0)).toBe(false);
    const result = playBattleCardResolved(stunnedState, card.id, 0);
    expect(result.state).toBe(stunnedState);
  });

  it("can play a 0-cost card with 0 mana", () => {
    const card = makeTestCard({ cost: 0, effects: [{ kind: "damage", damageType: "physical", amount: 1 }] });
    const state = makeState({ mana: 0, enemyHealth: 30, hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.mana).toBe(0);
    expect(result.state.enemyHealth).toBe(29);
  });

  it("deducts cost before restore-mana and caps the refund at maxMana", () => {
    const card = makeTestCard({ cost: 1, effects: [{ kind: "restore-mana", amount: 2 }] });
    const state = makeState({ mana: 4, maxMana: 4, hand: [card] });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.mana).toBe(4);
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

  it("converts only available Mana when Mana Shield is discounted", () => {
    const card = makeTestCard({
      id: "mana-shield",
      cost: 1,
      effects: [{ kind: "player-status", status: "block", amount: 0, convertCurrentMana: 5 }],
    });
    const base = makeState({ mana: 3, hand: [card] });
    const state = {
      ...base,
      flags: { ...base.flags, nextCardCostReduction: 1 },
    };

    const result = playBattleCardResolved(state, card.id, 0);

    expect(result.state.mana).toBe(0);
    expect(result.state.playerStatuses.block).toBe(15);
  });

  it("restores Mana only when Ray of Frost causes a new Freeze", () => {
    const card = makeTestCard({
      id: "ray-of-frost",
      cost: 1,
      effects: [
        { kind: "damage", damageType: "freeze", amount: 1 },
        { kind: "damage", damageType: "freeze", amount: 1 },
        { kind: "restore-mana", amount: 1, ifEnemyFrozen: true },
      ],
    });
    const freshTarget = makeState({ mana: 1, enemyHealth: 4, enemyMaxHealth: 4, hand: [card] });
    const alreadyFrozen = makeState({
      mana: 1,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: { freezeSkipTurns: 1, stunSkipTurns: 0, cooldown: 2 },
      hand: [card],
    });

    expect(playBattleCardResolved(freshTarget, card.id, 0).state.mana).toBe(1);
    expect(playBattleCardResolved(alreadyFrozen, card.id, 0).state.mana).toBe(0);
  });

  it("converts only the next actual damage effect to Poison", () => {
    const card = makeTestCard({
      id: "two-hits",
      cost: 1,
      effects: [
        { kind: "damage", damageType: "physical", amount: 2 },
        { kind: "damage", damageType: "physical", amount: 2 },
      ],
    });
    const base = makeState({ hand: [card] });
    const state = { ...base, flags: { ...base.flags, nextHitPoison: true } };

    const result = playBattleCardResolved(state, card.id, 0);

    expect(result.state.enemyStatuses.poison).toBe(2);
    expect(result.state.flags.nextHitPoison).toBe(false);
    expect(result.combatTexts.filter((text) => text.kind === "damage").map((text) => text.stat)).toEqual([
      "poison",
      "physical",
    ]);
  });

  it("keeps next-hit Poison armed when a chance card deals no damage", () => {
    const card = makeTestCard({
      id: "uncertain-hit",
      cost: 1,
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [{ kind: "damage", damageType: "physical", amount: 2 }],
          failureEffects: [{ kind: "heal", amount: 1 }],
        },
      ],
    });
    const base = makeState({ hand: [card], rng: () => 0.9 });
    const state = { ...base, flags: { ...base.flags, nextHitPoison: true } };

    const result = playBattleCardResolved(state, card.id, 0);

    expect(result.state.flags.nextHitPoison).toBe(true);
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

  it("applies Nature card Block and Photosynthesis once when playing a Nature card", () => {
    const card = makeTestCard({
      id: "vines",
      cost: 1,
      effects: [
        { kind: "damage", damageType: "nature", amount: 2 },
        { kind: "damage", damageType: "nature", amount: 2 },
      ],
    });
    const state = makeState({
      hand: [card],
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: {
        ...makeState().talentEffects,
        blockOnNatureCard: 3,
        healOnNatureCard: 1,
      },
    });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.playerStatuses.block).toBe(3);
    expect(result.state.playerHealth).toBe(11);
  });

  it("applies consume talent riders but ignores summon-companion cards", () => {
    const potion = makeTestCard({
      id: "apple",
      cost: 1,
      consume: true,
      effects: [{ kind: "heal", amount: 2 }],
    });
    const summon = makeTestCard({
      id: "wolf-companion",
      cost: 1,
      consume: true,
      effects: [{ kind: "summon-companion", companionId: "wolf" }],
    });
    const talents = {
      ...makeState().talentEffects,
      healOnConsume: 1,
      goldOnConsume: 1,
      poisonOnConsume: 1,
      blockOnConsume: 2,
      drawOnConsume: 1,
    };
    const potionState = makeState({
      hand: [potion],
      playerHealth: 10,
      playerMaxHealth: 30,
      gold: 0,
      deck: [makeTestCard({ id: "drawn" })],
      talentEffects: talents,
    });
    const potionResult = playBattleCardResolved(potionState, potion.id, 0);
    expect(potionResult.state.gold).toBe(1);
    expect(potionResult.state.playerStatuses.block).toBe(2);
    expect(potionResult.state.enemyStatuses.poison).toBe(1);
    expect(potionResult.state.hand.some((c) => c.id === "drawn")).toBe(true);
    expect(potionResult.state.flags.consumeDrawUsedThisTurn).toBe(true);

    const secondPotion = makeTestCard({
      id: "bread",
      cost: 1,
      consume: true,
      effects: [{ kind: "heal", amount: 2 }],
    });
    const second = playBattleCardResolved(
      {
        ...potionResult.state,
        hand: [secondPotion],
        mana: 5,
        deck: [makeTestCard({ id: "should-not-draw" })],
      },
      secondPotion.id,
      0,
    );
    expect(second.state.hand.some((c) => c.id === "should-not-draw")).toBe(false);

    const summonResult = playBattleCardResolved(
      makeState({
        hand: [summon],
        playerHealth: 10,
        playerMaxHealth: 30,
        gold: 0,
        talentEffects: talents,
      }),
      summon.id,
      0,
    );
    expect(summonResult.state.activeCompanion?.id).toBe("wolf");
    expect(summonResult.state.gold).toBe(0);
    expect(summonResult.state.playerStatuses.block).toBe(0);
    expect(summonResult.state.enemyStatuses.poison).toBe(0);
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

  it("grants Resonant Chime mana once per turn after enough cards", () => {
    const card1 = makeTestCard({ id: "c1", cost: 0, effects: [] });
    const card2 = makeTestCard({ id: "c2", cost: 0, effects: [] });
    const state = makeState({
      mana: 3,
      maxMana: 6,
      hand: [card1, card2],
      cardsPlayedThisTurn: 2,
      trinketEffects: {
        ...makeState().trinketEffects,
        resonantChimeCardsRequired: 3,
        resonantChimeMana: 1,
      },
    });
    const first = playBattleCardResolved(state, card1.id, 0);
    expect(first.state.mana).toBe(4);
    expect(first.state.flags.resonantChimeUsedThisTurn).toBe(true);
    const second = playBattleCardResolved(first.state, card2.id, 0);
    expect(second.state.mana).toBe(first.state.mana);
  });

  it("Resonant Chime holds its charge at full mana instead of consuming it", () => {
    const card = makeTestCard({ id: "c1", cost: 0, effects: [] });
    const state = makeState({
      mana: 3,
      maxMana: 3,
      hand: [card],
      cardsPlayedThisTurn: 2,
      trinketEffects: {
        ...makeState().trinketEffects,
        resonantChimeCardsRequired: 3,
        resonantChimeMana: 1,
      },
    });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.mana).toBe(3);
    expect(result.state.flags.resonantChimeUsedThisTurn).toBe(false);
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

  it("allows play after enemy defeat when allowAfterEnemyDefeat is set", () => {
    const card = makeTestCard({
      id: "c1",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const state = makeState({ enemyHealth: 0, hand: [card], mana: 3 });
    const result = playBattleCardResolved(state, "c1", 0, { allowAfterEnemyDefeat: true });
    expect(result.state.hand).toHaveLength(0);
    expect(result.state.discard[0]?.id).toBe("c1");
    expect(result.state.mana).toBe(2);
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

  it("blocks cleanse-only cards when the player has no harmful statuses", () => {
    const card = makeTestCard({
      id: "cleanse",
      cost: 1,
      effects: [{ kind: "remove-harmful-status", amount: 1 }],
    });
    const state = makeState({ mana: 4, hand: [card] });
    expect(canPlayCard(state, card, 0)).toBe(false);
    const result = playBattleCardResolved(state, "cleanse", 0);
    expect(result.state).toBe(state);
  });

  it("allows mixed-purpose cleanse cards with no harmful statuses", () => {
    const card = makeTestCard({
      id: "mixed-panacea-heal",
      cost: 1,
      effects: [
        { kind: "remove-harmful-status", amount: 1 },
        { kind: "heal", amount: 4 },
      ],
    });
    const state = makeState({ mana: 4, playerHealth: 20, hand: [card] });
    expect(canPlayCard(state, card, 0)).toBe(true);
  });
});

describe("isAttackCard / hasDamageEffect", () => {
  it("treats recursive damage as an attack", () => {
    const card = makeTestCard({
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [{ kind: "damage", damageType: "physical", amount: 3 }],
          failureEffects: [{ kind: "heal", amount: 2 }],
        },
      ],
    });
    expect(hasDamageEffect(card.effects)).toBe(true);
    expect(isAttackCard(card)).toBe(true);
  });

  it("treats status-only cards as casts", () => {
    const card = makeTestCard({
      effects: [{ kind: "player-status", status: "block", amount: 5 }],
    });
    expect(hasDamageEffect(card.effects)).toBe(false);
    expect(isAttackCard(card)).toBe(false);
  });
});

describe("enemyAttackDealsDamage", () => {
  it("is true for hit packets and false for status-only packets", () => {
    expect(enemyAttackDealsDamage([{ kind: "damage", damageType: "physical", amount: 4 }])).toBe(true);
    expect(enemyAttackDealsDamage([{ kind: "player-status", status: "bleed", amount: 2 }])).toBe(false);
  });
});

describe("reworked cards", () => {
  it("blackjack steals gold only when the enemy is stunned", () => {
    const card = { ...cardById["blackjack"] };
    const unstunned = playBattleCardResolved(makeState({ hand: [card] }), card.id, 0);
    expect(unstunned.state.gold).toBe(0);

    const stunned = playBattleCardResolved(
      makeState({ hand: [{ ...card }], enemyCC: { freezeSkipTurns: 0, stunSkipTurns: 1, cooldown: 0 } }),
      card.id,
      0,
    );
    expect(stunned.state.gold).toBe(2);
  });

  it("sniff-out draws a card and makes the next archery card free", () => {
    const card = { ...cardById["sniff-out"] };
    const state = makeState({ hand: [card], deck: slashDeck(2) });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.hand).toHaveLength(1);
    expect(result.state.flags.nextArcheryCardFree).toBe(true);
    expect(result.state.exhausted).toContainEqual(expect.objectContaining({ id: "sniff-out" }));
  });

  it("stargaze deals freeze damage and opens a wish", () => {
    const card = { ...cardById["stargaze"] };
    const result = playBattleCardResolved(makeState({ hand: [card] }), card.id, 0);
    expect(result.state.enemyStatuses.freeze).toBeGreaterThan(0);
    expect(result.state.wishOptions).toHaveLength(3);
  });

  it("ray-of-frost hits now and queues a freeze echo", () => {
    const card = { ...cardById["ray-of-frost"] };
    const result = playBattleCardResolved(makeState({ hand: [card] }), card.id, 0);
    expect(result.state.enemyStatuses.freeze).toBeGreaterThan(0);
    expect(result.state.pendingTurnStartEffects).toHaveLength(1);
    expect(result.state.pendingTurnStartEffects[0]?.effects).toEqual([
      { kind: "damage", damageType: "freeze", amount: 1 },
    ]);
  });

  it("briar-shield grants block and thorns", () => {
    const card = { ...cardById["briar-shield"] };
    const result = playBattleCardResolved(makeState({ hand: [card] }), card.id, 0);
    expect(result.state.playerStatuses.block).toBe(1);
    expect(result.state.playerStatuses.thorns).toBe(3);
  });

  it("spiked-shield grants block and thorns", () => {
    const card = { ...cardById["spiked-shield"] };
    const result = playBattleCardResolved(makeState({ hand: [card] }), card.id, 0);
    expect(result.state.playerStatuses.block).toBe(2);
    expect(result.state.playerStatuses.thorns).toBe(2);
  });

  it("thorn-mail grants armor and thorns", () => {
    const card = { ...cardById["thorn-mail"] };
    const result = playBattleCardResolved(makeState({ hand: [card] }), card.id, 0);
    expect(result.state.playerStatuses.armor).toBe(2);
    expect(result.state.playerStatuses.thorns).toBe(1);
  });

  it("luck-potion restores mana on a successful flip", () => {
    const card = { ...cardById["luck-potion"] };
    const result = playBattleCardResolved(makeState({ hand: [card], mana: 1, rng: () => 0 }), card.id, 0);
    expect(result.state.mana).toBe(4);
  });

  it("luck-potion grants block when both flips fail", () => {
    const card = { ...cardById["luck-potion"] };
    const result = playBattleCardResolved(makeState({ hand: [card], rng: () => 0.99 }), card.id, 0);
    expect(result.state.playerStatuses.block).toBe(4);
    expect(result.state.gold).toBe(0);
  });

  it("luck-potion steals gold on a split flip", () => {
    const card = { ...cardById["luck-potion"] };
    const draws = [0.99, 0];
    const result = playBattleCardResolved(makeState({ hand: [card], rng: () => draws.shift() ?? 0.5 }), card.id, 0);
    expect(result.state.gold).toBe(4);
    expect(result.state.playerStatuses.block).toBe(0);
  });
});
