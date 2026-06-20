// Dev and run-end battle outcome shortcuts (skip combat, abandon run).
import type { BattleState } from "@/lib/battle";
import { isAlchemyDevBuild } from "../../shared/utils";
import { readBattleStore } from "../../shared/stores/run-session-facade";
import type { Screen } from "../../shared/types";

export function createBattleDevOutcomes(params: {
  screen: Screen;
  resetBattleSession: () => void;
  handleVictoryDefeat: (outcome: "victory" | "defeat") => void;
}) {
  const getStore = () => readBattleStore();

  function forceBattleOutcome(outcome: "victory" | "defeat", patch: (state: BattleState) => BattleState) {
    params.resetBattleSession();
    getStore().setSyncedBattleState(patch);
    params.handleVictoryDefeat(outcome);
  }

  function handleEndRun() {
    if (params.screen !== "battle") return;
    forceBattleOutcome("defeat", (c) => ({
      ...c,
      playerHealth: 0,
      deathsDoorUsed: true,
      deathsDoorActive: false,
      deathsDoorGraceTurnsRemaining: null,
    }));
  }

  function skipCombatDevMode() {
    if (!isAlchemyDevBuild() || params.screen !== "battle") return;
    forceBattleOutcome("victory", (c) => ({ ...c, enemyHealth: 0, wishOptions: null, wishQueue: [] }));
  }

  return { handleEndRun, skipCombatDevMode };
}
