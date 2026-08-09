import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  setDestinationOfferState,
  setHasActiveBattle,
  setRewardState,
  setRoomsEncountered,
  setCurrentAct,
  setDestinationIndexInAct,
  setCompletedDestinations,
  setMysteryCardChoices,
  createDraftRunRandomSource,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { setCompletedDifficulties } from "@/features/alchemy/shared/stores/profile-store";
import { clearBattlePresentationUi } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { createInitialDestinationResult } from "@/features/alchemy/shared/run-flow/destination-flow";
import { getBossEnemy } from "@/features/alchemy/shared/config";
import type { MaterialInventory } from "@/lib/homestead/types";
import { ACTS_PER_RUN } from "@/lib/game-constants";
import { CONSTANTS } from "../../shared/types";
import type { RunFlowHandlerDeps, RunFlowSiblingHandlers } from "./run-flow-handler-deps";

export function createProgressionHandlers(deps: RunFlowHandlerDeps, handlers: RunFlowSiblingHandlers) {
  function prepareNextDestination(destinationIndexInAct: number = 0, onCommitted?: () => void) {
    deps.actions.navigateTo(CONSTANTS.SCREENS.DESTINATION, () => {
      dispatchRunSessionCommand((draft) => {
        const run = draft.run.activeRun;
        const initialDestinations = createInitialDestinationResult({
          availableDestinations: deps.getAvailableDestinations({ destinationIndexInAct }),
          offerState: {
            lastOfferedDestinations: run.lastOfferedDestinations,
            roundsSinceOffered: run.destinationRoundsSinceOffered,
          },
          bossEnemyId: getBossEnemy([], createDraftRunRandomSource(draft, "world")).id,
          rng: createDraftRunRandomSource(draft, "destinations"),
        });
        setDestinationOfferState(draft, initialDestinations.offerState);
        setRewardState(draft, initialDestinations.rewardState);
      });
      handlers.prepareDestinationScreen();
      onCommitted?.();
    });
  }

  function handleActComplete(displayMaterials?: MaterialInventory, onRenderedScreenCommit?: () => void) {
    dispatchRunSessionCommand(
      (draft) => {
        setHasActiveBattle(draft, false);
        if (deps.run.currentAct >= ACTS_PER_RUN) {
          if (deps.run.selectedDifficulty) {
            setCompletedDifficulties(draft, (previous) => ({
              ...previous,
              [deps.run.characterId]: previous[deps.run.characterId].includes(deps.run.selectedDifficulty!)
                ? previous[deps.run.characterId]
                : [...previous[deps.run.characterId], deps.run.selectedDifficulty!],
            }));
          }
          return true;
        }
        setCurrentAct(draft, (p) => p + 1);
        setDestinationIndexInAct(draft, 0);
        setCompletedDestinations(draft, []);
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
      (draft) => {
        setRoomsEncountered(draft, (p) => p + 1);
        if (deps.run.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
          return true;
        }
        setMysteryCardChoices(draft, []);
        return false;
      },
      {
        afterCommit: (labyrinth) => {
          clearBattlePresentationUi();
          if (labyrinth) {
            deps.actions.labyrinthClearNode();
            deps.actions.navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP);
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
