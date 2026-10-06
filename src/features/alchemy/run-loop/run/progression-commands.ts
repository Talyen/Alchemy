import { getBossById, rollFreshBossId } from "@/features/alchemy/shared/config";
import { isBossOnlyDestinationOffer } from "@/features/alchemy/shared/run-flow/destination-flow";
import { sampleAndApplyDestinationOffer } from "@/features/alchemy/shared/stores/destination-offer-command";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  type RunTransaction,
} from "@/features/alchemy/shared/stores/run-session-command";
import {
  abandonCorruptionDestinationVisit,
  clearMysteryVisitState,
  clearShopOfferings,
  completeRunRoom,
  createDraftRunRandomSource,
  setCompletedDestinations,
  setCompletedDifficulties,
  setCorruptionResult,
  setCurrentAct,
  setDestinationIndexInAct,
  setRewardState,
  setRoomsEncountered,
  setRunProgressActivity,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { ACTS_PER_RUN } from "@/lib/game-constants";
import { GAME_EDITION_POLICY, IS_DEMO } from "@/lib/game-edition";
import type { RunFlowHandlerDeps } from "./run-flow";

export function createProgressionCommands(
  getAvailableDestinations: RunFlowHandlerDeps["getAvailableDestinations"],
  gameSession: GameSession,
) {
  function clearCompletedDestinationState(draft: RunTransaction) {
    completeRunRoom(draft);
    setRoomsEncountered(draft, (p) => p + 1);
    clearMysteryVisitState(draft);
    clearShopOfferings(draft);
    setCorruptionResult(draft, null);
  }

  function setNextDestinationState(draft: RunTransaction, destinationIndexInAct?: number) {
    sampleAndApplyDestinationOffer(
      draft,
      getAvailableDestinations({
        destinationIndexInAct: destinationIndexInAct ?? draft.run.activeRun.destinationIndexInAct,
      }),
    );
  }

  function prepareDestinationScreen() {
    const state = readRunSession(gameSession).rewardFlow.state;
    const bossOnly = isBossOnlyDestinationOffer(state.destinations);
    if (!bossOnly) {
      if (state.selectedBossId) {
        dispatchRunSessionCommand(
          (draft) => {
            setRewardState(draft, (prev) => ({ ...prev, selectedBossId: null }));

            return acceptCommand();
          },
          undefined,
          gameSession,
        );
      }
      return;
    }
    if (state.selectedBossId && getBossById(state.selectedBossId)) return;
    dispatchRunSessionCommand(
      (draft) => {
        const selectedBossId = rollFreshBossId(createDraftRunRandomSource(draft, "world"));
        setRewardState(draft, (prev) => ({ ...prev, selectedBossId }));

        return acceptCommand();
      },
      undefined,
      gameSession,
    );
  }

  return {
    prepareDestinationScreen,
    prepareNextDestination: (index?: number) =>
      dispatchRunSessionCommand(
        (draft) => acceptCommand(setNextDestinationState(draft, index)),
        undefined,
        gameSession,
      ),
    completeAct: () =>
      dispatchRunSessionCommand(
        (draft) => {
          const run = draft.run.activeRun;
          if (run.currentAct >= (IS_DEMO ? GAME_EDITION_POLICY.campaignActs : ACTS_PER_RUN)) {
            const selectedDifficulty = run.selectedDifficulty;
            if (selectedDifficulty && !IS_DEMO) {
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
            return acceptCommand(true);
          }
          setCurrentAct(draft, (p) => p + 1);
          setDestinationIndexInAct(draft, 0);
          setCompletedDestinations(draft, []);
          return acceptCommand(false);
        },
        undefined,
        gameSession,
      ),
    leaveCorruption: () =>
      dispatchRunSessionCommand(
        (draft) => {
          abandonCorruptionDestinationVisit(draft);
          setRunProgressActivity(draft, "destination");
          return acceptCommand();
        },
        undefined,
        gameSession,
      ),
    completeDestination: () =>
      dispatchRunSessionCommand(
        (draft) => {
          const labyrinth = draft.run.activeRun.contentSystemType === CONTENT_SYSTEMS.LABYRINTH;
          clearCompletedDestinationState(draft);
          if (labyrinth) setRunProgressActivity(draft, "labyrinth-map");
          else setNextDestinationState(draft);

          return acceptCommand();
        },
        undefined,
        gameSession,
      ),
  };
}
