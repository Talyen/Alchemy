import { awardMaterialsDuringRun } from "@/features/alchemy/shared/stores/run-session-write-port";
import {
  beginRewardClaim,
  releaseRewardClaim as releaseRewardClaimState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import {
  createRunSessionCommand,
  dispatchRunSessionCommand,
} from "@/features/alchemy/shared/stores/run-session-command";
import { createDraftRunRandomSource } from "@/features/alchemy/shared/stores/run-session-write-port";
import { setCompanionRewardCards, setRewardState } from "@/features/alchemy/shared/stores/run-session-write-port";
import { useUiStore } from "../../shared/stores/ui-store";
import { playUISound } from "@/lib/audio";
import {
  finalizeRewardState,
  getActiveRewardModifiersForContentSystem,
  shouldGrantAlchemistReward,
  executeRewardRouteTransition,
} from "../navigation/reward-flow";
import { applyAlchemistPotion, applyRewardSelection } from "./run-destination-handlers";
import { CONSTANTS } from "../../shared/types";
import type { CompleteRunVictory, HandleActComplete, RunFlowHandlerDeps } from "./run-flow-handler-deps";

const commandSetRewardState = createRunSessionCommand(setRewardState);
const commandSetCompanionRewardCards = createRunSessionCommand(setCompanionRewardCards);
const commandReleaseRewardClaim = createRunSessionCommand(releaseRewardClaimState);

interface RewardCallbacks {
  completeRunVictory: CompleteRunVictory;
  handleActComplete: HandleActComplete;
}

export function createRewardHandlers(
  deps: RunFlowHandlerDeps,
  { completeRunVictory, handleActComplete }: RewardCallbacks,
) {
  function selectRewardChoice(id: string) {
    commandSetRewardState((prev) => ({ ...prev, selectedId: id }));
    deps.actions.selectRewardChoice(id);
  }

  function finishRewards() {
    dispatchRunSessionCommand(
      (draft) => {
        if (!beginRewardClaim(draft)) return null;
        const session = draft.session;

        const grantAlchemistReward = shouldGrantAlchemistReward(
          getActiveRewardModifiersForContentSystem(
            deps.run.contentSystemType,
            deps.run.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD
              ? (draft.session.wildwoodDraft?.currentRewardTraitIds ?? [])
              : draft.session.activeLabyrinthRewardModifiers,
          ),
        );
        const result = finalizeRewardState({
          rewardState: current(session.rewardState),
          companionRewardCards: session.companionRewardCards ? current(session.companionRewardCards) : null,
        });

        // Keep the live offer UI until onRenderedScreenCommit so Victory does not
        // hollow during NAVIGATION_DELAY_MS + PAGE_EXIT_MS. Mid-claim autosave
        // persists companion handoff or destination continuation (not the claimed primary).

        const isWildwood = deps.run.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD;
        if (!isWildwood) awardMaterialsDuringRun(draft, result.materials);

        if (result.selectedChoice) {
          applyRewardSelection({
            choice: result.selectedChoice,
            type: result.selectedRewardType,
            draft,
          });
        }
        if (grantAlchemistReward) {
          applyAlchemistPotion({
            draft,
            rng: createDraftRunRandomSource(draft, "rewards"),
          });
        }

        return { result, isWildwood };
      },
      {
        afterCommit: (commit) => {
          if (!commit) return;
          const { result, isWildwood } = commit;

          const settleClaimSurface = () => {
            commandSetRewardState(result.nextRewardState);
            if (result.clearCompanionRewardCards) commandSetCompanionRewardCards(null);
            commandReleaseRewardClaim();
          };

          if (result.selectedChoice) playUISound("talentUnlock");
          useUiStore.getState().clearCardHover();
          if (isWildwood && result.route !== CONSTANTS.REWARD_ROUTES.COMPANION_REWARD) {
            deps.actions.wildwoodRewardComplete(settleClaimSurface);
            return;
          }
          executeRewardRouteTransition(
            result.route,
            result.materials,
            result.nextRewardState,
            result.clearCompanionRewardCards,
            {
              navigateTo: (screen, onCommit) => {
                deps.actions.navigateTo(screen, () => {
                  onCommit?.();
                  commandReleaseRewardClaim();
                });
              },
              completeRunVictory: (materials, onCommit) => {
                completeRunVictory(materials, () => {
                  onCommit?.();
                  commandReleaseRewardClaim();
                });
              },
              handleActComplete: (materials) => {
                handleActComplete(materials, () => {
                  // prepareNextDestination / victory commit overwrite offer state;
                  // only the claim lock must be released here.
                  commandReleaseRewardClaim();
                });
              },
              labyrinthClearNode: deps.actions.labyrinthClearNode,
              setCompanionRewardCards: commandSetCompanionRewardCards,
              setRewardState: commandSetRewardState,
            },
          );
        },
      },
    );
  }

  return {
    selectRewardChoice,
    finishRewards,
  };
}
import { current } from "immer";
