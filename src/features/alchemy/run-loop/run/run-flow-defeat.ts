import { readActiveRun } from "@/features/alchemy/shared/stores/run-session-read-port";
import {
  applyRunDefeatTeardown,
  clearBattleUi,
  finalizeRunEndSession,
} from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { finalizeRunXP } from "@/features/alchemy/shared/stores/run-session-write-port";
import { useUiStore } from "../../shared/stores/ui-store";
import { stopAllSfx } from "@/lib/audio";
import type { MaterialInventory } from "@/lib/homestead/types";
import { CONSTANTS } from "../../shared/types";
import { awardRunEndMaterials, clearCombatPresentation, clearCombatState } from "./run-flow-session-helpers";
import type { RunFlowContext } from "./run-flow-context";

export function createDefeatHandlers(ctx: RunFlowContext) {
  const { deps } = ctx;

  function endRunAndShowGameOver() {
    applyRunDefeatTeardown({
      awardRunEndMaterials,
      finalizeRunXP,
      clearCombatState,
      clearCombatPresentation,
    });
    deps.dispatch({
      type: "transition",
      screen: CONSTANTS.SCREENS.GAME_OVER,
      options: { immediate: true },
    });
  }

  function handleBattleDefeat() {
    const runState = readActiveRun();
    if (runState.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
      stopAllSfx();
      clearCombatState();
      clearCombatPresentation();
      deps.dispatch({ type: "labyrinth-fail-node" });
      deps.dispatch({ type: "navigate", screen: CONSTANTS.SCREENS.LABYRINTH_MAP });
      return;
    }
    endRunAndShowGameOver();
  }

  function endLabyrinthRun() {
    if (deps.run.contentSystemType !== CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) return;
    endRunAndShowGameOver();
  }

  function handleAbandonRun() {
    useUiStore.getState().clearCardHover();
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
    deps.dispatch({
      type: "navigate",
      screen: CONSTANTS.SCREENS.RUN_VICTORY,
      ...(onRenderedScreenCommit ? { onRenderedScreenCommit } : {}),
    });
  }

  return {
    endRunAndShowGameOver,
    handleBattleDefeat,
    handleAbandonRun,
    endLabyrinthRun,
    completeRunVictory,
  };
}
