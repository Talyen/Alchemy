import { describe, expect, it } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import {
  getPlayableHandCardKeys,
  getPlayableHandCardKeysExcludingHidden,
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

    const playable = getPlayableHandCardKeysExcludingHidden(state, new Set(["draw-3"]));
    expect(playable.has("slash-1")).toBe(true);
    expect(playable.has("draw-3")).toBe(false);
  });
});
