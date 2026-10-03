import { describe, expect, it, vi } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import {
  findBestPlayableHandCard,
  findBestWishChoice,
  getPlayableHandCardKeys,
  handHasPlayableCard,
  handHasHiddenCard,
} from "@/features/alchemy/run-loop/battle/playable-hand";
import { makeTestBattleState } from "../../../../fixtures/battle";
import { makeTestCard } from "../../../../fixtures/cards";
import { cardById, type BattleCard } from "@/lib/game-data";
import * as battle from "@/lib/battle";

const affordableCard: BattleCard = {
  id: "slash",
  title: "Slash",
  descriptionLines: [""],
  art: "",
  cost: 1,
  effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
  uid: 1,
};

const expensiveCard: BattleCard = {
  ...affordableCard,
  id: "meteor",
  cost: 9,
  uid: 2,
};

describe("handHasPlayableCard", () => {
  it("stops validating once it finds a playable card", () => {
    const validate = vi.spyOn(battle, "canPlayCard");
    const state = makeTestBattleState({ hand: [expensiveCard, affordableCard, affordableCard], mana: 2 });
    expect(handHasPlayableCard(state)).toBe(true);
    expect(validate).toHaveBeenCalledTimes(2);
    expect(handHasPlayableCard({ ...state, hand: [expensiveCard] })).toBe(false);
    expect(handHasPlayableCard({ ...state, hand: [] })).toBe(false);
  });

  it("keeps the post-defeat play option and Wish gate", () => {
    const state = makeTestBattleState({ hand: [affordableCard], enemyHealth: 0, mana: 2 });
    expect(handHasPlayableCard(state)).toBe(true);
    expect(handHasPlayableCard(state, { allowAfterEnemyDefeat: false })).toBe(false);
    expect(handHasPlayableCard({ ...state, wishOptions: [affordableCard] })).toBe(false);
  });
});

describe("getPlayableHandCardKeys", () => {
  it("uses live play eligibility and index keys without confusing repeated copies", () => {
    const cleanse = makeTestCard({ id: "cleanse", effects: [{ kind: "remove-harmful-status", amount: 1 }] });
    const state = makeTestBattleState({ hand: [affordableCard, expensiveCard, cleanse, cleanse], mana: 2 });
    expect(getPlayableHandCardKeys(state)).toEqual(new Set(["slash-1"]));
    const afflicted = { ...state, playerStatuses: { ...state.playerStatuses, burn: 1 } };
    expect(getPlayableHandCardKeys(afflicted)).toEqual(new Set(["slash-1", "cleanse-no-uid-2", "cleanse-no-uid-3"]));
    expect(handHasHiddenCard(afflicted, ["cleanse-no-uid-3"])).toBe(true);
    expect(handHasHiddenCard({ ...afflicted, hand: [affordableCard] }, ["cleanse-no-uid-3"])).toBe(false);
    expect(getPlayableHandCardKeys({ ...afflicted, wishOptions: [affordableCard] })).toEqual(new Set());
    expect(getPlayableHandCardKeys({ ...afflicted, playerHealth: 0, deathsDoorActive: false })).toEqual(new Set());
  });
});

describe("findBestPlayableHandCard", () => {
  const weakHit = makeTestCard({
    id: "weak-hit",
    cost: 1,
    effects: [{ kind: "damage", damageType: "physical", amount: 2 }],
  });
  const strongHit = makeTestCard({
    id: "strong-hit",
    cost: 1,
    effects: [{ kind: "damage", damageType: "physical", amount: 9 }],
  });
  const guard = makeTestCard({
    id: "guard",
    cost: 1,
    effects: [{ kind: "player-status", status: "block", amount: 5 }],
  });

  function greedyState(hand: BattleCard[], overrides = {}) {
    return makeTestBattleState({
      hand,
      mana: 3,
      turnPhase: "player",
      wishOptions: null,
      enemyHealth: 30,
      playerHealth: 100,
      playerMaxHealth: 100,
      ...overrides,
    });
  }

  it("picks the highest-scoring card ahead of hand order", () => {
    const state = greedyState([
      { ...weakHit, uid: 1 },
      { ...strongHit, uid: 2 },
    ]);

    expect(findBestPlayableHandCard(state)?.card.uid).toBe(2);
  });

  it("breaks score ties with the leftmost card", () => {
    const state = greedyState([
      { ...weakHit, uid: 1 },
      { ...weakHit, uid: 2 },
    ]);

    expect(findBestPlayableHandCard(state)?.card.uid).toBe(1);
  });

  it("skips unaffordable cards even when they score highest", () => {
    const pricey = makeTestCard({
      id: "pricey",
      cost: 9,
      effects: [{ kind: "damage", damageType: "burn", amount: 20 }],
    });
    const state = greedyState(
      [
        { ...pricey, uid: 1 },
        { ...weakHit, uid: 2 },
      ],
      { mana: 1 },
    );

    expect(findBestPlayableHandCard(state)?.card.uid).toBe(2);
  });

  it("prefers damage at full health over a weaker guard", () => {
    const state = greedyState([
      { ...guard, uid: 1 },
      { ...strongHit, uid: 2 },
    ]);

    expect(findBestPlayableHandCard(state)?.card.uid).toBe(2);
  });

  it("restricts to defensive cards at half health when any are playable", () => {
    const state = greedyState(
      [
        { ...strongHit, uid: 1 },
        { ...guard, uid: 2 },
      ],
      { playerHealth: 50 },
    );

    expect(findBestPlayableHandCard(state)?.card.uid).toBe(2);
  });

  it("still plays damage at half health when no defensive card is playable", () => {
    const state = greedyState(
      [
        { ...weakHit, uid: 1 },
        { ...strongHit, uid: 2 },
      ],
      { playerHealth: 50 },
    );

    expect(findBestPlayableHandCard(state)?.card.uid).toBe(2);
  });

  it.each(["mana-shield", "crystal-bulwark"])("recognizes %s as a resource-based defense", (id) => {
    const resourceGuard = cardById[id]!;
    const state = greedyState([strongHit, resourceGuard], { playerHealth: 10 });
    expect(findBestPlayableHandCard(state)?.card.id).toBe(id);
    const competingGuards = greedyState([guard, resourceGuard], { playerHealth: 10, mana: 4, maxMana: 8 });
    expect(findBestPlayableHandCard(competingGuards)?.card.id).toBe(id);
  });

  it("does not autoplay a lethal opening Health cost after Death's Door is spent", () => {
    const offering = cardById["blood-offering"]!;
    const state = greedyState([offering, weakHit], { playerHealth: 1, deathsDoorUsed: true });
    expect(findBestPlayableHandCard(state)?.card.id).toBe(weakHit.id);
    expect(findBestPlayableHandCard({ ...state, hand: [offering] })).toBeNull();
    expect(findBestPlayableHandCard({ ...state, hand: [offering], deathsDoorUsed: false })?.card.id).toBe(offering.id);
    expect(
      findBestPlayableHandCard({
        ...state,
        hand: [offering],
        playerStatuses: { ...state.playerStatuses, phoenixFeather: 1 },
      })?.card.id,
    ).toBe(offering.id);
  });

  it("leaves repeated Health costs to manual play when the second resolution is lethal", () => {
    const offering = cardById["blood-offering"]!;
    const state = greedyState([offering], {
      playerHealth: 2,
      deathsDoorUsed: true,
      flags: { ...defaultBattleState().flags, playNextCardTwice: true },
    });
    expect(playBattleCardResolved({ ...state, rng: () => 0.99 }, offering.id, 0).state.playerHealth).toBe(0);
    expect(findBestPlayableHandCard(state)).toBeNull();
  });

  it("does not prioritize Mana Shield as defense when a free play would convert zero Mana", () => {
    const shield = cardById["mana-shield"]!;
    const hit = strongHit;
    const state = greedyState([shield, hit], {
      playerHealth: 10,
      mana: 0,
      flags: { ...defaultBattleState().flags, nextCardCostReduction: 99 },
    });
    expect(playBattleCardResolved({ ...state, rng: () => 0.99 }, shield.id, 0).state.playerStatuses.block).toBe(0);
    expect(findBestPlayableHandCard(state)?.card.id).toBe(hit.id);
  });

  it("recognizes Luck Potion's nested Block outcome when seeking defense at low Health", () => {
    const potion = cardById["luck-potion"]!;
    const state = greedyState([strongHit, potion], { playerHealth: 10, mana: 3, maxMana: 3 });
    expect(playBattleCardResolved({ ...state, rng: () => 0.99 }, potion.id, 1).state.playerStatuses.block).toBe(4);
    expect(findBestPlayableHandCard(state)?.card.id).toBe(potion.id);
  });

  it.each(["exorcism", "cauterize", "dark-pact"])(
    "leaves %s to manual play when its self-damage could be lethal",
    (id) => {
      const state = greedyState([cardById[id]!, weakHit], {
        playerHealth: 1,
        deathsDoorUsed: true,
      });
      expect(findBestPlayableHandCard(state)?.card.id).toBe(weakHit.id);
    },
  );

  it("does not mistake an unneeded cleanse for defense at low Health", () => {
    const state = greedyState([cardById.cauterize!, strongHit], { playerHealth: 50 });
    expect(findBestPlayableHandCard(state)?.card.id).toBe(strongHit.id);
  });

  it("does not spend a Mana Potion when Mana is full", () => {
    const potion = makeTestCard({
      id: "mana-potion",
      cost: 0,
      consume: true,
      effects: [{ kind: "restore-mana", amount: 2 }],
    });
    const state = greedyState([potion, weakHit], { mana: 3, maxMana: 3 });
    expect(findBestPlayableHandCard(state)?.card.id).toBe(weakHit.id);
  });

  it("does not spend a draw card when the hand is full", () => {
    const draw = makeTestCard({
      id: "draw",
      cost: 0,
      consume: true,
      effects: [{ kind: "draw-cards", amount: 4 }],
    });
    const state = greedyState([draw, strongHit, weakHit, weakHit, weakHit, weakHit, weakHit], {
      deck: [strongHit],
    });
    expect(findBestPlayableHandCard(state)?.card.id).toBe(strongHit.id);
  });

  it("values a heal by Health actually missing", () => {
    const heal = makeTestCard({ id: "heal", effects: [{ kind: "heal", amount: 4 }] });
    const state = greedyState([heal, weakHit], { playerHealth: 99 });
    expect(findBestPlayableHandCard(state)?.card.id).toBe(weakHit.id);
  });

  it("returns null when nothing is playable", () => {
    const state = greedyState([{ ...strongHit, uid: 1 }], { mana: 0 });

    expect(findBestPlayableHandCard(state)).toBeNull();
  });
});

describe("findBestWishChoice", () => {
  it("chooses a safe Wish when another choice has a lethal Health cost", () => {
    const safe = makeTestCard({ id: "safe", effects: [{ kind: "damage", damageType: "physical", amount: 2 }] });
    const state = makeTestBattleState({
      playerHealth: 1,
      deathsDoorUsed: true,
      wishOptions: [cardById["dark-pact"]!, safe],
    });
    expect(findBestWishChoice(state)?.id).toBe(safe.id);
  });

  it("picks the highest-scoring wish option", () => {
    const slash = makeTestCard({
      id: "slash",
      effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
    });
    const ignite = makeTestCard({
      id: "ignite",
      effects: [{ kind: "enemy-status", status: "burn", amount: 10 }],
    });
    const state = makeTestBattleState({ wishOptions: [slash, ignite] });

    expect(findBestWishChoice(state)?.id).toBe("ignite");
  });

  it("breaks score ties with the earliest option", () => {
    const first = makeTestCard({
      id: "first",
      effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
    });
    const second = makeTestCard({
      id: "second",
      effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
    });
    const state = makeTestBattleState({ wishOptions: [first, second] });

    expect(findBestWishChoice(state)?.id).toBe("first");
  });

  it("returns null without wish options", () => {
    expect(findBestWishChoice(makeTestBattleState({ wishOptions: null }))).toBeNull();
    expect(findBestWishChoice(makeTestBattleState({ wishOptions: [] }))).toBeNull();
  });
});
