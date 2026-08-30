import { describe, expect, it } from "vitest";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { CARDS_PER_TURN } from "@/lib/game-constants";
import { makeTestBattleState, makeTestCardWithId } from "../../fixtures/battle";

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
});
