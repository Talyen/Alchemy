import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import {
  setDestinationOfferState,
  setHasActiveBattle,
  setRewardState,
  setRoomsEncountered,
  setCurrentAct,
  setDestinationIndexInAct,
  setCompletedDestinations,
  clearMysteryVisitState,
  clearShopOfferings,
  setCorruptionResult,
  createDraftRunRandomSource,
  abandonCorruptionDestinationVisit,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { setCompletedDifficulties } from "@/features/alchemy/shared/stores/profile-store";
import { clearBattlePresentationUi } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { createInitialDestinationResult } from "@/features/alchemy/shared/run-flow/destination-flow";
import { getBossById, rollFreshBossId } from "@/features/alchemy/shared/config";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import type { MaterialInventory } from "@/lib/homestead/types";
import { ACTS_PER_RUN } from "@/lib/game-constants";
import type { CompleteRunVictory, RunFlowHandlerDeps } from "./run-flow-handler-deps";
import { DESTINATIONS, ROUTE_SCREENS } from "@/lib/routing";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";

interface ProgressionCallbacks {
  completeRunVictory: CompleteRunVictory;
}

export function createProgressionHandlers(deps: RunFlowHandlerDeps, { completeRunVictory }: ProgressionCallbacks) {
  function clearCompletedDestinationState(draft: GameplayDraft) {
    setRoomsEncountered(draft, (p) => p + 1);
    clearMysteryVisitState(draft);
    clearShopOfferings(draft);
    setCorruptionResult(draft, null);
  }

  function setNextDestinationState(draft: GameplayDraft, destinationIndexInAct?: number) {
    const run = draft.run.activeRun;
    const indexInAct = destinationIndexInAct ?? run.destinationIndexInAct;
    const initialDestinations = createInitialDestinationResult({
      availableDestinations: deps.getAvailableDestinations({ destinationIndexInAct: indexInAct }),
      offerState: {
        lastOfferedDestinations: run.lastOfferedDestinations,
        roundsSinceOffered: run.destinationRoundsSinceOffered,
      },
      bossEnemyId: rollFreshBossId(createDraftRunRandomSource(draft, "world")),
      rng: createDraftRunRandomSource(draft, "destinations"),
    });
    setDestinationOfferState(draft, initialDestinations.offerState);
    setRewardState(draft, initialDestinations.rewardState);
  }

  function prepareDestinationScreen() {
    const state = readRunSession().rewardState;
    const bossOnly = state.destinations.length === 1 && state.destinations[0] === DESTINATIONS.BOSS_COMBAT;
    if (!bossOnly) return;
    if (state.selectedBossId && getBossById(state.selectedBossId)) return;
    dispatchRunSessionCommand((draft) => {
      const selectedBossId = rollFreshBossId(createDraftRunRandomSource(draft, "world"));
      setRewardState(draft, (prev) => ({ ...prev, selectedBossId }));
    });
  }

  function prepareNextDestination(destinationIndexInAct?: number, onCommitted?: () => void) {
    deps.actions.navigateTo(ROUTE_SCREENS.DESTINATION, () => {
      dispatchRunSessionCommand((draft) => {
        setNextDestinationState(draft, destinationIndexInAct);
      });
      prepareDestinationScreen();
      onCommitted?.();
    });
  }

  function handleActComplete(displayMaterials?: MaterialInventory, onRenderedScreenCommit?: () => void) {
    dispatchRunSessionCommand(
      (draft) => {
        setHasActiveBattle(draft, false);
        const run = draft.run.activeRun;
        if (run.currentAct >= ACTS_PER_RUN) {
          if (run.selectedDifficulty) {
            setCompletedDifficulties(draft, (previous) => {
              const completed = previous[run.characterId] ?? [];
              return {
                ...previous,
                [run.characterId]: completed.includes(run.selectedDifficulty!)
                  ? completed
                  : [...completed, run.selectedDifficulty!],
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
    deps.actions.navigateTo(ROUTE_SCREENS.DESTINATION, () => {
      dispatchRunSessionCommand((draft) => {
        abandonCorruptionDestinationVisit(draft);
      });
      prepareDestinationScreen();
    });
  }

  function advanceToNextDestination() {
    const labyrinth = readActiveRun().contentSystemType === CONTENT_SYSTEMS.LABYRINTH;
    const nextScreen = labyrinth ? ROUTE_SCREENS.LABYRINTH_MAP : ROUTE_SCREENS.DESTINATION;

    deps.actions.navigateTo(nextScreen, () => {
      dispatchRunSessionCommand((draft) => {
        clearCompletedDestinationState(draft);
        if (!labyrinth) setNextDestinationState(draft);
      });
      clearBattlePresentationUi();
      if (labyrinth) deps.actions.labyrinthClearNode();
      else prepareDestinationScreen();
    });
  }

  return {
    prepareNextDestination,
    prepareDestinationScreen,
    handleActComplete,
    advanceToNextDestination,
    returnToCurrentDestination,
  };
}
