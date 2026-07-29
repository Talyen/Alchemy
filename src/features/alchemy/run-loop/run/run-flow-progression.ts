import { setRewardState, clearBattleUi } from "../../shared/stores/run-session-facade";
import { useUiStore } from "../../shared/stores/ui-store";
import type { MaterialInventory } from "@/lib/homestead/types";
import { ACTS_PER_RUN } from "@/lib/game-constants";
import { CONSTANTS } from "../../shared/types";
import type { RunFlowContext } from "./run-flow-context";

export function createProgressionHandlers(ctx: RunFlowContext) {
  const { deps } = ctx;

  function prepareNextDestination(destinationIndexInAct: number = 0, onCommitted?: () => void) {
    deps.dispatch({
      type: "navigate",
      screen: CONSTANTS.SCREENS.DESTINATION,
      onRenderedScreenCommit: () => {
        setRewardState(deps.contentNav.createInitialDestinations({ destinationIndexInAct }));
        ctx.prepareDestinationScreen();
        onCommitted?.();
      },
    });
  }

  function handleActComplete(displayMaterials?: MaterialInventory) {
    clearBattleUi();
    if (deps.run.currentAct >= ACTS_PER_RUN) {
      if (deps.run.selectedDifficulty) {
        deps.dispatch({
          type: "mark-difficulty-completed",
          characterId: deps.run.characterId,
          difficultyId: deps.run.selectedDifficulty,
        });
      }
      ctx.completeRunVictory(displayMaterials);
      return;
    }
    deps.run.setCurrentAct((p) => p + 1);
    deps.run.setDestinationIndexInAct(0);
    deps.run.setCompletedDestinations([]);
    prepareNextDestination(0);
  }

  function advanceToNextDestination() {
    deps.run.setRoomsEncountered((p) => p + 1);
    if (deps.run.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
      deps.dispatch({ type: "labyrinth-clear-node" });
      useUiStore.getState().clearCardHover();
      deps.dispatch({ type: "navigate", screen: CONSTANTS.SCREENS.LABYRINTH_MAP });
      return;
    }
    useUiStore.getState().clearCardHover();
    deps.dispatch({ type: "clear-mystery-card-choices" });
    prepareNextDestination();
  }

  return {
    prepareNextDestination,
    handleActComplete,
    advanceToNextDestination,
  };
}
