import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  setDestinationOfferState,
  setHasActiveBattle,
  setRewardState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { clearBattlePresentationUi } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import type { MaterialInventory } from "@/lib/homestead/types";
import { ACTS_PER_RUN } from "@/lib/game-constants";
import { CONSTANTS } from "../../shared/types";
import type { RunFlowHandlerDeps, RunFlowSiblingHandlers } from "./run-flow-handler-deps";

export function createProgressionHandlers(deps: RunFlowHandlerDeps, handlers: RunFlowSiblingHandlers) {
  function prepareNextDestination(destinationIndexInAct: number = 0, onCommitted?: () => void) {
    deps.dispatch({
      type: "navigate",
      screen: CONSTANTS.SCREENS.DESTINATION,
      onRenderedScreenCommit: () => {
        dispatchRunSessionCommand(() => {
          const initialDestinations = deps.contentNav.createInitialDestinations({ destinationIndexInAct });
          setDestinationOfferState(initialDestinations.offerState);
          setRewardState(initialDestinations.rewardState);
        });
        handlers.prepareDestinationScreen();
        onCommitted?.();
      },
    });
  }

  function handleActComplete(displayMaterials?: MaterialInventory, onRenderedScreenCommit?: () => void) {
    dispatchRunSessionCommand(
      () => {
        setHasActiveBattle(false);
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
        deps.run.updateCurrentAct((p) => p + 1);
        deps.run.updateDestinationIndexInAct(0);
        deps.run.updateCompletedDestinations([]);
        return false;
      },
      {
        afterCommit: (runComplete) => {
          clearBattlePresentationUi();
          if (runComplete) {
            handlers.completeRunVictory(displayMaterials ?? null, onRenderedScreenCommit);
          } else {
            prepareNextDestination(0, onRenderedScreenCommit);
          }
        },
      },
    );
  }

  function advanceToNextDestination() {
    dispatchRunSessionCommand(
      () => {
        deps.run.updateRoomsEncountered((p) => p + 1);
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
