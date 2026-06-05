import { describe, expect, it } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { getPlayableHandCardKeys } from "@/features/alchemy/run-loop/battle/playable-hand";
import type { BattleCard } from "@/lib/game-data";

const affordableCard: BattleCard = {
  id: "slash",
  title: "Slash",
  descriptionLines: [""],
  art: "",
  cost: 1,
  effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
  uid: "a",
};

const expensiveCard: BattleCard = {
  ...affordableCard,
  id: "meteor",
  cost: 9,
  uid: "b",
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
    expect(playable.has("slash-a")).toBe(true);
    expect(playable.has("meteor-b")).toBe(false);
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
