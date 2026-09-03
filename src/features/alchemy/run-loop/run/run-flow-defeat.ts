import { readActiveRun } from "@/features/alchemy/shared/stores/run-reads";
import {
  applyRunDefeatTeardown,
  clearBattleUi,
  finalizeRunEndSession,
} from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { finalizeRunXP } from "@/features/alchemy/shared/stores/run-session-write-port";
import { awardRunEndMaterials, clearCombatPresentation, clearCombatState } from "./run-flow-session-helpers";
import type { RunFlowHandlerDeps } from "./run-flow-handler-deps";
import { ROUTE_SCREENS } from "@/lib/routing";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";

export function createDefeatHandlers(deps: RunFlowHandlerDeps) {
  function endRunAndShowGameOver() {
    applyRunDefeatTeardown({
      awardRunEndMaterials,
      finalizeRunXP,
      clearCombatState,
      clearCombatPresentation,
    });
    deps.actions.transition(ROUTE_SCREENS.GAME_OVER, { immediate: true });
  }

  function handleBattleDefeat() {
    endRunAndShowGameOver();
  }

  function isLabyrinthRun() {
    return readActiveRun().contentSystemType === CONTENT_SYSTEMS.LABYRINTH;
  }

  function endLabyrinthRun() {
    if (!isLabyrinthRun()) return;
    endRunAndShowGameOver();
  }

  function handleAbandonRun() {
    deps.actions.clearCardHover();
    endRunAndShowGameOver();
  }

  function completeRunVictory(onRenderedScreenCommit?: () => void) {
    clearBattleUi();
    finalizeRunEndSession({
      awardRunEndMaterials,
      finalizeRunXP,
    });
    deps.actions.navigateTo(ROUTE_SCREENS.RUN_VICTORY, onRenderedScreenCommit);
  }

  return {
    endRunAndShowGameOver,
    handleBattleDefeat,
    handleAbandonRun,
    endLabyrinthRun,
    completeRunVictory,
  };
}
