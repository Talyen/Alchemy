import { describe, expect, it, vi, beforeEach } from "vitest";
import { createBattleDevOutcomes } from "@/features/alchemy/run-loop/battle/battle-status";
import type { BattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";
import type { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { setSyncedBattleState } from "@/features/alchemy/shared/stores/run-session-write-port";
import { defaultBattleState } from "@/lib/battle";
import { resetBattlePresentationAndRun } from "./battle-test-reset";

function makeDevOutcomes(screen: string) {
  const resetBattleSession = vi.fn();
  const handleVictoryDefeat = vi.fn();
  const session = { resetBattleSession, handleVictoryDefeat } as unknown as ReturnType<typeof createBattleSession>;
  const ctx = { screen } as unknown as BattleControllerContext;
  return { api: createBattleDevOutcomes(ctx, session), resetBattleSession, handleVictoryDefeat };
}

beforeEach(() => {
  resetBattlePresentationAndRun();
  dispatchRunSessionCommand((draft) => setSyncedBattleState(draft, defaultBattleState()));
});

describe("skipCombatDevMode", () => {
  it("forces victory and clears wish state on the battle screen", () => {
    const { api, handleVictoryDefeat } = makeDevOutcomes("battle");

    api.skipCombatDevMode();

    expect(handleVictoryDefeat).toHaveBeenCalledWith("victory");
    const state = readBattle().battleState;
    expect(state.enemyHealth).toBe(0);
    expect(state.wishOptions).toBeNull();
  });

  it("no-ops off the battle screen", () => {
    const { api, handleVictoryDefeat } = makeDevOutcomes("map");

    api.skipCombatDevMode();

    expect(handleVictoryDefeat).not.toHaveBeenCalled();
  });
});
