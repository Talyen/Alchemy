import { describe, expect, it } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import {
  getPlayableHandCardKeys,
  getPlayableHandCardKeysExcludingHidden,
  handHasHiddenCard,
} from "@/features/alchemy/run-loop/battle/playable-hand";
import type { BattleCard } from "@/lib/game-data";

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
    const playable = getPlayableHandCardKeysExcludingHidden(state, ["draw-3"], false, shared);

    expect(shared.has("draw-3")).toBe(true);
    expect(playable.has("draw-3")).toBe(false);
    expect(playable).not.toBe(shared);
  });

  it("returns empty while a card transfer is in progress", () => {
    const state = {
      ...defaultBattleState(),
      turnPhase: "player" as const,
      mana: 2,
      wishOptions: null,
      hand: [affordableCard],
    };

    expect(getPlayableHandCardKeysExcludingHidden(state, [], true).size).toBe(0);
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
