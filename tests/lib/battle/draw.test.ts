import { describe, expect, it, vi } from "vitest";
import { defaultBattleState, endPlayerTurn, playBattleCardResolved } from "@/lib/battle";
import { drawCards, drawKeywordCard, takeRandomCardFromDeck } from "@/lib/battle/draw";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { CARDS_PER_TURN, MAX_HAND_SIZE } from "@/lib/game-constants";
import { makeTestBattleState, makeTestCardWithId, patchBattleState, seededRng } from "../../fixtures/battle";

const makeCard = makeTestCardWithId;

describe("defaultBattleState", () => {
  it("isolates nested combat state so one battle cannot alter the next battle's defaults", () => {
    const first = defaultBattleState();
    const next = defaultBattleState();
    const before = structuredClone({
      playerStatuses: next.playerStatuses,
      enemyStatuses: next.enemyStatuses,
      flags: next.flags,
      talents: next.talentEffects,
      gear: next.gearEffects,
      deck: next.deck,
    });
    first.playerStatuses.block = 5;
    first.enemyStatuses.burn = 3;
    first.flags.nextHitCrit = true;
    first.talentEffects.companionBondLevels.wolf = 4;
    first.talentEffects.healthThresholdArmor.push({ threshold: 50, amount: 3 });
    first.gearEffects.flatPhysicalDamage = 10;
    first.deck.push(makeCard("previous-battle"));
    expect({
      playerStatuses: next.playerStatuses,
      enemyStatuses: next.enemyStatuses,
      flags: next.flags,
      talents: next.talentEffects,
      gear: next.gearEffects,
      deck: next.deck,
    }).toEqual(before);
  });
});

describe("drawCards — edge cases", () => {
  it("mid-draw reshuffles discard when deck runs out", () => {
    const deck = [makeTestCardWithId("d1")];
    const discard = [makeTestCardWithId("d2"), makeTestCardWithId("d3"), makeTestCardWithId("d4")];
    Object.freeze(deck);
    Object.freeze(discard);
    const rng = vi.fn(() => 0);
    const result = drawCards(deck, discard, [], 4, 0, rng);
    expect(result.hand.map((card) => card.id)).toEqual(["d1", "d2", "d4", "d3"]);
    expect(result.hand.map((card) => card.uid)).toEqual([0, 1, 2, 3]);
    expect(result.deck).toHaveLength(0);
    expect(result.discard).toHaveLength(0);
    expect(rng).toHaveBeenCalledTimes(2);
    expect(deck.map((card) => card.id)).toEqual(["d1"]);
    expect(discard.map((card) => card.id)).toEqual(["d2", "d3", "d4"]);
  });

  it("both piles empty returns empty hand unchanged", () => {
    const result = drawCards([], [], [], 4, 0, seededRng(1));
    expect(result.hand).toHaveLength(0);
    expect(result.deck).toHaveLength(0);
    expect(result.discard).toHaveLength(0);
  });

  it("both piles empty with existing hand leaves hand unchanged", () => {
    const hand = [makeTestCardWithId("h1")];
    const result = drawCards([], [], hand, 4, 0, seededRng(1));
    expect(result.hand).toHaveLength(1);
    expect(result.hand[0].id).toBe("h1");
  });

  it("draws single card from single-card deck with empty discard", () => {
    const deck = [makeTestCardWithId("d1")];
    const result = drawCards(deck, [], [], 1, 0, seededRng(1));
    expect(result.hand).toHaveLength(1);
    expect(result.hand[0].id).toBe("d1");
    expect(result.deck).toHaveLength(0);
  });

  it("reserves excess draws with a near-full hand", () => {
    const hand = Array.from({ length: 6 }, (_, i) => makeTestCardWithId(`h${i}`));
    const deck = [makeTestCardWithId("d1"), makeTestCardWithId("d2"), makeTestCardWithId("d3")];
    const result = drawCards(deck, [], hand, 4, 0, seededRng(1));
    expect(result.hand).toHaveLength(7);
    expect(result.deck).toHaveLength(0);
    expect(result.pendingHandCards.map((card) => card.id)).toEqual(["d2", "d1"]);
  });

  it("reserves draws when hand is already at MAX_HAND_SIZE", () => {
    const hand = Array.from({ length: MAX_HAND_SIZE }, (_, i) => makeTestCardWithId(`h${i}`));
    const deck = [makeTestCardWithId("d1"), makeTestCardWithId("d2"), makeTestCardWithId("d3")];
    const result = drawCards(deck, [], hand, 4, 0, seededRng(1));
    expect(result.hand).toHaveLength(MAX_HAND_SIZE);
    expect(result.deck).toHaveLength(0);
    expect(result.pendingHandCards.map((card) => card.id)).toEqual(["d3", "d2", "d1"]);
  });

  it("drawing 0 cards does nothing", () => {
    const deck = [makeCard("d1")];
    const hand = [makeCard("h1")];
    const result = drawCards(deck, [], hand, 0, 0, seededRng(1));
    expect(result.hand).toHaveLength(1);
    expect(result.deck).toHaveLength(1);
  });

  it("delivers older reserved cards before a new draw", () => {
    const pending = [makeCard("older"), makeCard("newer")];
    const result = drawCards(
      [makeCard("fresh")],
      [],
      Array.from({ length: 5 }, (_, i) => makeCard(`h${i}`)),
      1,
      20,
      seededRng(1),
      pending,
    );
    expect(result.hand.slice(5).map((card) => card.id)).toEqual(["older", "newer"]);
    expect(result.pendingHandCards.map((card) => card.id)).toEqual(["fresh"]);
  });

  it("all drawn cards get unique uids", () => {
    const deck = [makeCard("d1"), makeCard("d2"), makeCard("d3")];
    const result = drawCards(deck, [], [], 3, 100, seededRng(1));
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

  it("reserves a keyword card and delivers it before a played card draws", () => {
    const played = makeTestCardWithId("played", { uid: 1, effects: [{ kind: "draw-cards", amount: 1 }] });
    const physical = makeTestCardWithId("physical", {
      effects: [{ kind: "damage", damageType: "physical", amount: 2 }],
    });
    const hand = [played, ...Array.from({ length: 6 }, (_, i) => makeTestCardWithId(`h${i}`))];
    const reserved = drawKeywordCard(makeTestBattleState({ hand, deck: [makeCard("later"), physical] }), "physical");
    expect(reserved.pendingHandCards.map((card) => card.id)).toEqual(["physical"]);
    expect(reserved.deck.map((card) => card.id)).toEqual(["later"]);

    const afterPlay = playBattleCardResolved(reserved, played.id, 0).state;
    expect(afterPlay.hand.at(-1)?.id).toBe("physical");
    expect(afterPlay.pendingHandCards.map((card) => card.id)).toEqual(["later"]);
  });

  it("delivers waiting cards after end-turn discard before the next ordinary draw", () => {
    const hand = Array.from({ length: MAX_HAND_SIZE }, (_, i) => makeCard(`h${i}`));
    const state = makeTestBattleState({
      hand,
      pendingHandCards: [makeCard("waiting")],
      deck: [makeCard("ordinary")],
      enemyCC: { stunSkipTurns: 1, freezeSkipTurns: 0, cooldown: 0 },
      rng: () => 0.99,
    });
    const next = endPlayerTurn(state).state;
    expect(next.hand[0]?.id).toBe("waiting");
    expect(next.hand.some((card) => card.id === "ordinary")).toBe(true);
    expect(next.pendingHandCards).toEqual([]);
  });
});

describe("takeRandomCardFromDeck", () => {
  it.each(["deck", "discard"] as const)("preserves the %s input and seeded draw order", (pile) => {
    const cards = [makeCard("a", { uid: 1 }), makeCard("b", { uid: 2 }), makeCard("c", { uid: 3 })];
    const rng = vi.fn(() => 0);
    const state = patchBattleState({
      deck: pile === "deck" ? cards : [],
      discard: pile === "discard" ? cards : [],
      nextCardUid: 40,
      uniqueGear: { returningFlightUid: 1, lastArcheryUid: 2 },
      rng,
    });
    Object.freeze(state.deck);
    Object.freeze(state.discard);

    const result = takeRandomCardFromDeck(state)!;
    expect(result.card.id).toBe(pile === "deck" ? "a" : "b");
    expect(result.card.uid).toBe(40);
    expect(result.nextCardUid).toBe(41);
    expect(result.deck.map((card) => card.id)).toEqual(pile === "deck" ? ["b", "c"] : ["c", "a"]);
    expect(result.discard).toEqual([]);
    expect(result.uniqueGear.returningFlightUid).toBe(pile === "deck" ? 40 : 1);
    expect(result.uniqueGear.lastArcheryUid).toBe(pile === "discard" ? 40 : 2);
    expect(rng).toHaveBeenCalledTimes(pile === "deck" ? 1 : 3);
    expect(cards.map((card) => card.id)).toEqual(["a", "b", "c"]);
  });
});

describe("player turn transition", () => {
  it("draws the next hand and restores player mana", () => {
    const state = makeTestBattleState({
      turnPhase: "enemy",
      deck: Array.from({ length: 5 }, (_, index) => makeTestCardWithId(`draw-${index}`)),
      hand: [],
      mana: 0,
      maxMana: 4,
      rng: () => 0,
    });
    const result = advanceToPlayerTurn(state);
    expect(result.hand).toHaveLength(CARDS_PER_TURN);
    expect(result.mana).toBe(4);
    expect(result.turnPhase).toBe("player");
  });

  it("triggers an Emergency Wish when every draw pile is empty", () => {
    const state = makeTestBattleState({
      turnPhase: "enemy",
      deck: [],
      discard: [],
      hand: [],
      exhausted: [makeTestCardWithId("spent")],
      wishOptions: null,
      wishQueue: [],
    });
    const result = advanceToPlayerTurn(state);
    expect(result.wishOptions).toHaveLength(3);
    expect(result.turnPhase).toBe("player");
  });
});
