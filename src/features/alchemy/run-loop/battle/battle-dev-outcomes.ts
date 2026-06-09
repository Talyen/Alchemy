// Dev and run-end battle outcome shortcuts (skip combat, abandon run).
import type { BattleState } from "@/lib/battle";
import { isAlchemyDevBuild } from "../../shared/utils";
import { readBattleStore } from "../../shared/stores/run-session-facade";
import type { BattleControllerContext } from "./controller-context";

export function createBattleDevOutcomes(contextOrGetter: BattleControllerContext | (() => BattleControllerContext)) {
  const getContext = typeof contextOrGetter === "function" ? contextOrGetter : () => contextOrGetter;
  const getStore = () => readBattleStore();

  function forceBattleOutcome(outcome: "victory" | "defeat", patch: (state: BattleState) => BattleState) {
    getContext().resetBattleSession();
    getStore().setSyncedBattleState(patch);
    getContext().handleVictoryDefeat(outcome);
  }

  function handleEndRun() {
    if (getContext().screen !== "battle") return;
    forceBattleOutcome("defeat", (c) => ({
      ...c,
      playerHealth: 0,
      deathsDoorUsed: true,
      deathsDoorActive: false,
      deathsDoorGraceTurnsRemaining: null,
    }));
  }

  function skipCombatDevMode() {
    if (!isAlchemyDevBuild() || getContext().screen !== "battle") return;
    forceBattleOutcome("victory", (c) => ({ ...c, enemyHealth: 0, wishOptions: null, wishQueue: [] }));
  }

  return { handleEndRun, skipCombatDevMode };
}
