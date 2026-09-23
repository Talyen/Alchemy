import { getBossById, rollFreshBossId } from "@/features/alchemy/shared/config";
import {
  createInitialDestinationResult,
  isBossOnlyDestinationOffer,
} from "@/features/alchemy/shared/run-flow/destination-flow";
import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import {
  abandonCorruptionDestinationVisit,
  clearMysteryVisitState,
  clearShopOfferings,
  createDraftRunRandomSource,
  setCompletedDestinations,
  setCompletedDifficulties,
  setCorruptionResult,
  setCurrentAct,
  setDestinationIndexInAct,
  setDestinationOfferState,
  setHasActiveBattle,
  setRewardState,
  setRoomsEncountered,
  completeRunRoom,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { ACTS_PER_RUN } from "@/lib/game-constants";
import type { RunFlowHandlerDeps } from "./run-flow";

export function createProgressionCommands(getAvailableDestinations: RunFlowHandlerDeps["getAvailableDestinations"]) {
  function clearCompletedDestinationState(draft: GameplayDraft) {
    completeRunRoom(draft);
    setRoomsEncountered(draft, (p) => p + 1);
    clearMysteryVisitState(draft);
    clearShopOfferings(draft);
    setCorruptionResult(draft, null);
  }

  function setNextDestinationState(draft: GameplayDraft, destinationIndexInAct?: number) {
    const run = draft.run.activeRun;
    const indexInAct = destinationIndexInAct ?? run.destinationIndexInAct;
    const initialDestinations = createInitialDestinationResult({
      availableDestinations: getAvailableDestinations({ destinationIndexInAct: indexInAct }),
      offerState: {
        lastOfferedDestinations: run.lastOfferedDestinations,
        roundsSinceOffered: run.destinationRoundsSinceOffered,
      },
      rollBossEnemyId: () => rollFreshBossId(createDraftRunRandomSource(draft, "world")),
      rng: createDraftRunRandomSource(draft, "destinations"),
    });
    setDestinationOfferState(draft, initialDestinations.offerState);
    setRewardState(draft, initialDestinations.rewardState);
  }

  function prepareDestinationScreen() {
    const state = readRunSession().rewardFlow.state;
    const bossOnly = isBossOnlyDestinationOffer(state.destinations);
    if (!bossOnly) {
      if (state.selectedBossId) {
        dispatchRunSessionCommand((draft) => {
          setRewardState(draft, (prev) => ({ ...prev, selectedBossId: null }));
        });
      }
      return;
    }
    if (state.selectedBossId && getBossById(state.selectedBossId)) return;
    dispatchRunSessionCommand((draft) => {
      const selectedBossId = rollFreshBossId(createDraftRunRandomSource(draft, "world"));
      setRewardState(draft, (prev) => ({ ...prev, selectedBossId }));
    });
  }

  return {
    prepareDestinationScreen,
    prepareNextDestination: (index?: number) =>
      dispatchRunSessionCommand((draft) => setNextDestinationState(draft, index)),
    completeAct: () =>
      dispatchRunSessionCommand((draft) => {
        setHasActiveBattle(draft, false);
        const run = draft.run.activeRun;
        if (run.currentAct >= ACTS_PER_RUN) {
          const selectedDifficulty = run.selectedDifficulty;
          if (selectedDifficulty) {
            setCompletedDifficulties(draft, (previous) => {
              const completed = previous[run.characterId] ?? [];
              return {
                ...previous,
                [run.characterId]: completed.includes(selectedDifficulty)
                  ? completed
                  : [...completed, selectedDifficulty],
              };
            });
          }
          return true;
        }
        setCurrentAct(draft, (p) => p + 1);
        setDestinationIndexInAct(draft, 0);
        setCompletedDestinations(draft, []);
        return false;
      }),
    leaveCorruption: () => dispatchRunSessionCommand((draft) => abandonCorruptionDestinationVisit(draft)),
    completeDestination: () =>
      dispatchRunSessionCommand((draft) => {
        const labyrinth = draft.run.activeRun.contentSystemType === CONTENT_SYSTEMS.LABYRINTH;
        clearCompletedDestinationState(draft);
        if (!labyrinth) setNextDestinationState(draft);
      }),
  };
}
