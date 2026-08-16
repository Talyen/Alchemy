import { describe, expect, it } from "vitest";
import { selectAutosaveAllowed } from "@/features/alchemy/shared/stores/select-autosave-allowed";

function battleState(enemyHealth: number, hasActiveBattle = true) {
  return {
    battle: { hasActiveBattle, battleState: { enemyHealth } },
    session: { rewardClaimInFlight: false, rewardState: { choices: ["slash"] } },
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

  it("blocks hollow rewards and run-end screens", () => {
    expect(
      selectAutosaveAllowed(
        {
          battle: { hasActiveBattle: false, battleState: { enemyHealth: 20 } },
          session: { rewardClaimInFlight: false, rewardState: { choices: [] } },
        },
        "rewards",
      ),
    ).toBe(false);
    expect(selectAutosaveAllowed(battleState(20, false), "game-over")).toBe(false);
  });
});
