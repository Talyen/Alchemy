// Dev and run-end battle outcome shortcuts (skip combat, abandon run).
import type { BattleState } from "@/lib/battle";
import type { Screen } from "../types";
import { isAlchemyDevBuild } from "../utils";
import { useBattleStore } from "../stores/battle-store";

export type BattleDevOutcomesDeps = {
  screen: Screen;
  resetBattleSession: () => void;
  handleVictoryDefeat: (outcome: "victory" | "defeat") => void;
};

export function createBattleDevOutcomes(deps: BattleDevOutcomesDeps) {
  const getStore = () => useBattleStore.getState();

  function forceBattleOutcome(outcome: "victory" | "defeat", patch: (state: BattleState) => BattleState) {
    deps.resetBattleSession();
    getStore().setSyncedBattleState(patch);
    deps.handleVictoryDefeat(outcome);
  }

  function handleEndRun() {
    if (deps.screen !== "battle") return;
    forceBattleOutcome("defeat", (c) => ({
      ...c,
      playerHealth: 0,
      deathsDoorUsed: true,
      deathsDoorActive: false,
      deathsDoorGraceTurnsRemaining: null,
    }));
  }

  function skipCombatDevMode() {
    if (!isAlchemyDevBuild() || deps.screen !== "battle") return;
    forceBattleOutcome("victory", (c) => ({ ...c, enemyHealth: 0, wishOptions: null, wishQueue: [] }));
  }

  return { handleEndRun, skipCombatDevMode };
}
