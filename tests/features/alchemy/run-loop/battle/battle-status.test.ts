import { replaceBattleForTest as setSyncedBattleState } from "../../../../helpers/run-domain-store-test";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createBattleDevOutcomes } from "@/features/alchemy/run-loop/battle/battle-session";
import type { BattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";
import type { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";

import { defaultBattleState } from "@/lib/battle";
import { resetBattlePresentationAndRun } from "./battle-test-reset";
import { setRunSession } from "../../../../helpers/run-domain-store-test";

function makeDevOutcomes(screen: string) {
  const resetBattleSession = vi.fn();
  const handleVictoryDefeat = vi.fn();
  const session = { resetBattleSession, handleVictoryDefeat } as unknown as ReturnType<typeof createBattleSession>;
  const ctx = { screen } as unknown as BattleControllerContext;
  return { api: createBattleDevOutcomes(ctx, session), resetBattleSession, handleVictoryDefeat };
}

beforeEach(() => {
  resetBattlePresentationAndRun();
  dispatchGameplayCommand((draft) => acceptCommand(setSyncedBattleState(draft, defaultBattleState())));
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

  it("ignores a stale Skip Combat action without replacing the outgoing presentation", () => {
    const { api, resetBattleSession, handleVictoryDefeat } = makeDevOutcomes("battle");
    setRunSession({ hasActiveRun: false });
    api.skipCombatDevMode();
    expect(resetBattleSession).not.toHaveBeenCalled();
    expect(handleVictoryDefeat).not.toHaveBeenCalled();
  });
});
