import { describe, expect, it } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import {
  findBestPlayableHandCard,
  findBestWishChoice,
  getPlayableHandCardKeys,
  getPlayableHandCardKeysExcludingHidden,
  handHasHiddenCard,
} from "@/features/alchemy/run-loop/battle/playable-hand";
import { makeTestBattleState } from "../../../../fixtures/battle";
import { makeTestCard } from "../../../../fixtures/cards";
import { cardById, type BattleCard } from "@/lib/game-data";

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

describe("getPlayableHandCardKeys", () => {
  it("marks affordable player-phase cards as playable", () => {
    const state = {
      ...defaultBattleState(),
      turnPhase: "player" as const,
      mana: 2,
      wishOptions: null,
      hand: [affordableCard, expensiveCard],
    };

    const playable = getPlayableHandCardKeys(state);
    expect(playable.has("slash-1")).toBe(true);
    expect(playable.has("meteor-2")).toBe(false);
  });

  it("returns empty when wish options are active", () => {
    const state = {
      ...defaultBattleState(),
      turnPhase: "player" as const,
      mana: 9,
      wishOptions: [affordableCard],
      hand: [affordableCard],
    };

    expect(getPlayableHandCardKeys(state).size).toBe(0);
  });

  it("does not mark cleanse-only cards playable without a harmful status", () => {
    const cleanse: BattleCard = {
      ...affordableCard,
      id: "cleanse",
      effects: [{ kind: "remove-harmful-status", amount: 1 }],
      uid: 4,
    };
    const state = {
      ...defaultBattleState(),
      turnPhase: "player" as const,
      mana: 2,
      wishOptions: null,
      hand: [cleanse],
    };

    expect(getPlayableHandCardKeys(state).has("cleanse-4")).toBe(false);
  });

  it("marks cleanse-only cards playable when a harmful status is present", () => {
    const cleanse: BattleCard = {
      ...affordableCard,
      id: "cleanse",
      effects: [{ kind: "remove-harmful-status", amount: 1 }],
      uid: 4,
    };
    const state = {
      ...defaultBattleState(),
      turnPhase: "player" as const,
      mana: 2,
      wishOptions: null,
      hand: [cleanse],
      playerStatuses: { ...defaultBattleState().playerStatuses, burn: 1 },
    };

    expect(getPlayableHandCardKeys(state).has("cleanse-4")).toBe(true);
  });

  it("does not mark cards playable when the player is defeated", () => {
    const state = {
      ...defaultBattleState(),
      turnPhase: "player" as const,
      mana: 2,
      wishOptions: null,
      playerHealth: 0,
      deathsDoorActive: false,
      hand: [affordableCard],
    };

    expect(getPlayableHandCardKeys(state).has("slash-1")).toBe(false);
  });
});

describe("getPlayableHandCardKeysExcludingHidden", () => {
  it("excludes hidden keys but keeps other affordable cards", () => {
    const drawingCard: BattleCard = { ...affordableCard, id: "draw", uid: 3 };
    const state = {
      ...defaultBattleState(),
      turnPhase: "player" as const,
      mana: 2,
      wishOptions: null,
      hand: [affordableCard, drawingCard],
    };

    const playable = getPlayableHandCardKeysExcludingHidden(state, ["draw-3"]);
    expect(playable.has("slash-1")).toBe(true);
    expect(playable.has("draw-3")).toBe(false);
  });

  it("does not mutate a shared playable-keys set", () => {
    const drawingCard: BattleCard = { ...affordableCard, id: "draw", uid: 3 };
    const state = {
      ...defaultBattleState(),
      turnPhase: "player" as const,
      mana: 2,
      wishOptions: null,
      hand: [affordableCard, drawingCard],
    };
    const shared = getPlayableHandCardKeys(state);
    const playable = getPlayableHandCardKeysExcludingHidden(state, ["draw-3"], shared);

    expect(shared.has("draw-3")).toBe(true);
    expect(playable.has("draw-3")).toBe(false);
    expect(playable).not.toBe(shared);
  });

  it("keeps visible cards available independently of transfers", () => {
    const state = {
      ...defaultBattleState(),
      turnPhase: "player" as const,
      mana: 2,
      wishOptions: null,
      hand: [affordableCard],
    };

    expect(getPlayableHandCardKeysExcludingHidden(state, []).size).toBe(1);
  });
});

describe("handHasHiddenCard", () => {
  it("is true when a current hand card key is hidden", () => {
    const state = {
      ...defaultBattleState(),
      hand: [affordableCard],
    };
    expect(handHasHiddenCard(state, ["slash-1"])).toBe(true);
  });

  it("is false for hidden keys that are not in the current hand", () => {
    const state = {
      ...defaultBattleState(),
      hand: [affordableCard],
    };
    expect(handHasHiddenCard(state, ["meteor-2"])).toBe(false);
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
