import { readActiveRun } from "@/features/alchemy/shared/stores/run-session-read-port";
import {
  applyRunDefeatTeardown,
  clearBattleUi,
  finalizeRunEndSession,
} from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { finalizeRunXP } from "@/features/alchemy/shared/stores/run-session-write-port";
import { stopAllSfx } from "@/lib/audio";
import type { MaterialInventory } from "@/lib/homestead/types";
import { awardRunEndMaterials, clearCombatPresentation, clearCombatState } from "./run-flow-session-helpers";
import type { RunFlowHandlerDeps } from "./run-flow-handler-deps";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
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
    const runState = readActiveRun();
    if (runState.contentSystemType === CONTENT_SYSTEMS.LABYRINTH) {
      stopAllSfx();
      dispatchRunSessionCommand(clearCombatState);
      clearCombatPresentation();
      deps.actions.labyrinthFailNode();
      deps.actions.navigateTo(ROUTE_SCREENS.LABYRINTH_MAP);
      return;
    }
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
    if (isLabyrinthRun()) {
      endLabyrinthRun();
      return;
    }
    endRunAndShowGameOver();
  }

  function completeRunVictory(displayMaterials: MaterialInventory | null = null, onRenderedScreenCommit?: () => void) {
    clearBattleUi();
    finalizeRunEndSession({
      awardRunEndMaterials,
      finalizeRunXP,
      displayMaterials,
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
