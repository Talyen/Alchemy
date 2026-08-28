import type { BattleState } from "@/lib/battle";
import { setBattleState } from "@/features/alchemy/shared/stores/run-session-write-port";
import type { BattleControllerContext } from "./battle-context";
import type { createBattleSession } from "./battle-session";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";

export function createBattleDevOutcomes(ctx: BattleControllerContext, session: ReturnType<typeof createBattleSession>) {
  function forceBattleOutcome(outcome: "victory" | "defeat", patch: (state: BattleState) => BattleState) {
    session.resetBattleSession();
    dispatchRunSessionCommand((draft) => setBattleState(draft, patch));
    session.handleVictoryDefeat(outcome);
  }

  function handleEndRun() {
    if (ctx.screen !== "battle") return;
    forceBattleOutcome("defeat", (c) => ({
      ...c,
      playerHealth: 0,
      deathsDoorUsed: true,
      deathsDoorActive: false,
      deathsDoorGraceTurnsRemaining: null,
    }));
  }

  function skipCombatDevMode() {
    if (!import.meta.env.DEV || ctx.screen !== "battle") return;
    forceBattleOutcome("victory", (c) => ({ ...c, enemyHealth: 0, wishOptions: null, wishQueue: [] }));
  }

  return { handleEndRun, skipCombatDevMode };
}
