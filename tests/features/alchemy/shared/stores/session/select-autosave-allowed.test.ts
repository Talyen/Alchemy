import { describe, expect, it } from "vitest";
import { cardById } from "@/lib/game-data";
import { selectAutosaveAllowed } from "@/features/alchemy/shared/stores/session/run-reads";

function battleState(enemyHealth: number, hasActiveBattle = true) {
  return {
    battle: { hasActiveBattle, battleState: { enemyHealth, wishOptions: null } },
  };
}

describe("selectAutosaveAllowed", () => {
  it("stays allowed across non-lethal enemy health ticks", () => {
    expect(selectAutosaveAllowed(battleState(20), "battle")).toBe(true);
    expect(selectAutosaveAllowed(battleState(10), "battle")).toBe(true);
  });

  it("blocks when the enemy is dead during battle", () => {
    expect(selectAutosaveAllowed(battleState(0), "battle")).toBe(false);
  });

  it("saves a victorious battle while a Wish still awaits input", () => {
    const state = battleState(0);
    expect(
      selectAutosaveAllowed(
        { battle: { ...state.battle, battleState: { enemyHealth: 0, wishOptions: [cardById.slash!] } } },
        "battle",
      ),
    ).toBe(true);
  });

  it("allows hollow rewards (now persisted as interruptedFlow none) and blocks run-end screens", () => {
    expect(
      selectAutosaveAllowed(
        {
          battle: { hasActiveBattle: false, battleState: { enemyHealth: 20, wishOptions: null } },
        },
        "rewards",
      ),
    ).toBe(true);
    expect(selectAutosaveAllowed(battleState(20, false), "game-over")).toBe(false);
  });
});
