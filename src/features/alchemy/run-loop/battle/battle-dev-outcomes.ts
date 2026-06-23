// Dev and run-end battle outcome shortcuts (skip combat, abandon run).
import type { BattleState } from "@/lib/battle";
import { readBattleStore } from "../../shared/stores/run-session-facade";
import type { BattleControllerContext } from "./battle-context";
import type { createBattleSession } from "./battle-session";

export function createBattleDevOutcomes(ctx: BattleControllerContext, session: ReturnType<typeof createBattleSession>) {
  const getStore = () => readBattleStore();

  function forceBattleOutcome(outcome: "victory" | "defeat", patch: (state: BattleState) => BattleState) {
    session.resetBattleSession();
    getStore().setSyncedBattleState(patch);
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
