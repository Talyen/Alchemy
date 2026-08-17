import { readActiveRun } from "@/features/alchemy/shared/stores/run-session-read-port";
import {
  applyRunDefeatTeardown,
  clearBattleUi,
  finalizeRunEndSession,
} from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { finalizeRunXP } from "@/features/alchemy/shared/stores/run-session-write-port";
import { stopAllSfx } from "@/lib/audio";
import type { MaterialInventory } from "@/lib/homestead/types";
import { CONSTANTS } from "../../shared/types";
import { awardRunEndMaterials, clearCombatPresentation, clearCombatState } from "./run-flow-session-helpers";
import type { RunFlowHandlerDeps } from "./run-flow-handler-deps";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";

export function createDefeatHandlers(deps: RunFlowHandlerDeps) {
  function endRunAndShowGameOver() {
    applyRunDefeatTeardown({
      awardRunEndMaterials,
      finalizeRunXP,
      clearCombatState,
      clearCombatPresentation,
    });
    deps.actions.transition(CONSTANTS.SCREENS.GAME_OVER, { immediate: true });
  }

  function handleBattleDefeat() {
    const runState = readActiveRun();
    if (runState.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
      stopAllSfx();
      dispatchRunSessionCommand(clearCombatState);
      clearCombatPresentation();
      deps.actions.labyrinthFailNode();
      deps.actions.navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP);
      return;
    }
    endRunAndShowGameOver();
  }

  function endLabyrinthRun() {
    if (deps.run.contentSystemType !== CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) return;
    endRunAndShowGameOver();
  }

  function handleAbandonRun() {
    deps.actions.clearCardHover();
    if (deps.run.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
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
    deps.actions.navigateTo(CONSTANTS.SCREENS.RUN_VICTORY, onRenderedScreenCommit);
  }

  return {
    endRunAndShowGameOver,
    handleBattleDefeat,
    handleAbandonRun,
    endLabyrinthRun,
    completeRunVictory,
  };
}
