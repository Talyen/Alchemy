import {
  readBattleStore,
  runSessionTransaction,
  setRewardState,
  clearBattlePresentationUi,
} from "../../shared/stores/run-session-facade";
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
    runSessionTransaction(
      () => {
        readBattleStore().setHasActiveBattle(false);
        if (deps.run.currentAct >= ACTS_PER_RUN) {
          if (deps.run.selectedDifficulty) {
            deps.dispatch({
              type: "mark-difficulty-completed",
              characterId: deps.run.characterId,
              difficultyId: deps.run.selectedDifficulty,
            });
          }
          return true;
        }
        deps.run.setCurrentAct((p) => p + 1);
        deps.run.setDestinationIndexInAct(0);
        deps.run.setCompletedDestinations([]);
        return false;
      },
      {
        afterCommit: (runComplete) => {
          clearBattlePresentationUi();
          if (runComplete) {
            ctx.completeRunVictory(displayMaterials);
          } else {
            prepareNextDestination(0);
          }
        },
      },
    );
  }

  function advanceToNextDestination() {
    runSessionTransaction(
      () => {
        deps.run.setRoomsEncountered((p) => p + 1);
        if (deps.run.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
          deps.dispatch({ type: "labyrinth-clear-node" });
          return true;
        }
        deps.dispatch({ type: "clear-mystery-card-choices" });
        return false;
      },
      {
        afterCommit: (labyrinth) => {
          clearBattlePresentationUi();
          if (labyrinth) {
            deps.dispatch({ type: "navigate", screen: CONSTANTS.SCREENS.LABYRINTH_MAP });
          } else {
            prepareNextDestination();
          }
        },
      },
    );
  }

  return {
    prepareNextDestination,
    handleActComplete,
    advanceToNextDestination,
  };
}
