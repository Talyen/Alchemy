import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  setDestinationOfferState,
  setHasActiveBattle,
  setRewardState,
  setRoomsEncountered,
  setCurrentAct,
  setDestinationIndexInAct,
  setCompletedDestinations,
  clearMysteryVisitState,
  setCorruptionResult,
  createDraftRunRandomSource,
  abandonCorruptionDestinationVisit,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { setCompletedDifficulties } from "@/features/alchemy/shared/stores/profile-store";
import { clearBattlePresentationUi } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { createInitialDestinationResult } from "@/features/alchemy/shared/run-flow/destination-flow";
import { getBossById, getBossEnemy } from "@/features/alchemy/shared/config";
import { readRunSession } from "@/features/alchemy/shared/stores/run-session-read-port";
import type { MaterialInventory } from "@/lib/homestead/types";
import { ACTS_PER_RUN } from "@/lib/game-constants";
import { CONSTANTS } from "../../shared/types";
import type { CompleteRunVictory, RunFlowHandlerDeps } from "./run-flow-handler-deps";

interface ProgressionCallbacks {
  completeRunVictory: CompleteRunVictory;
}

export function createProgressionHandlers(deps: RunFlowHandlerDeps, { completeRunVictory }: ProgressionCallbacks) {
  function prepareDestinationScreen() {
    const state = readRunSession().rewardState;
    const bossOnly = state.destinations.length === 1 && state.destinations[0] === CONSTANTS.DESTINATIONS.BOSS_COMBAT;
    if (!bossOnly) return;
    if (state.selectedBossId && getBossById(state.selectedBossId)) return;
    dispatchRunSessionCommand((draft) => {
      const selectedBossId = getBossEnemy([], createDraftRunRandomSource(draft, "world")).id;
      setRewardState(draft, (prev) => ({ ...prev, selectedBossId }));
    });
  }

  function prepareNextDestination(destinationIndexInAct?: number, onCommitted?: () => void) {
    deps.actions.navigateTo(CONSTANTS.SCREENS.DESTINATION, () => {
      dispatchRunSessionCommand((draft) => {
        const run = draft.run.activeRun;
        const indexInAct = destinationIndexInAct ?? run.destinationIndexInAct;
        const initialDestinations = createInitialDestinationResult({
          availableDestinations: deps.getAvailableDestinations({ destinationIndexInAct: indexInAct }),
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
      prepareDestinationScreen();
      onCommitted?.();
    });
  }

  function handleActComplete(displayMaterials?: MaterialInventory, onRenderedScreenCommit?: () => void) {
    dispatchRunSessionCommand(
      (draft) => {
        setHasActiveBattle(draft, false);
        if (deps.run.currentAct >= ACTS_PER_RUN) {
          if (deps.run.selectedDifficulty) {
            setCompletedDifficulties(draft, (previous) => {
              const completed = previous[deps.run.characterId] ?? [];
              return {
                ...previous,
                [deps.run.characterId]: completed.includes(deps.run.selectedDifficulty!)
                  ? completed
                  : [...completed, deps.run.selectedDifficulty!],
              };
            });
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
            completeRunVictory(displayMaterials ?? null, onRenderedScreenCommit);
          } else {
            prepareNextDestination(0, onRenderedScreenCommit);
          }
        },
      },
    );
  }

  function returnToCurrentDestination() {
    deps.actions.navigateTo(CONSTANTS.SCREENS.DESTINATION, () => {
      dispatchRunSessionCommand((draft) => {
        abandonCorruptionDestinationVisit(draft);
      });
      prepareDestinationScreen();
    });
  }

  function advanceToNextDestination() {
    dispatchRunSessionCommand(
      (draft) => {
        setRoomsEncountered(draft, (p) => p + 1);
        clearMysteryVisitState(draft);
        setCorruptionResult(draft, null);
        return deps.run.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH;
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
    prepareDestinationScreen,
    handleActComplete,
    advanceToNextDestination,
    returnToCurrentDestination,
  };
}
