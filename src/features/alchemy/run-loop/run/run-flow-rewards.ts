import { awardMaterialsDuringRun } from "@/features/alchemy/shared/stores/run-session-write-port";
import {
  beginRewardClaim,
  releaseRewardClaim as releaseRewardClaimState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { bindRunRandomSource } from "@/features/alchemy/shared/stores/run-session-write-port";
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
import type { RunFlowHandlerDeps, RunFlowSiblingHandlers } from "./run-flow-handler-deps";

export function createRewardHandlers(deps: RunFlowHandlerDeps, handlers: RunFlowSiblingHandlers) {
  function selectRewardChoice(id: string) {
    setRewardState((prev) => ({ ...prev, selectedId: id }));
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
            setRunDeck: deps.run.updateRunDeck,
            setRunTrinkets: deps.run.updateRunTrinkets,
            draft,
          });
        }
        if (grantAlchemistReward) {
          applyAlchemistPotion({
            setRunDeck: deps.run.updateRunDeck,
            rng: bindRunRandomSource(deps.rewardRng, draft),
            draft,
          });
        }

        return { result, isWildwood };
      },
      {
        afterCommit: (commit) => {
          if (!commit) return;
          const { result, isWildwood } = commit;

          const settleClaimSurface = () => {
            setRewardState(result.nextRewardState);
            if (result.clearCompanionRewardCards) setCompanionRewardCards(null);
            releaseRewardClaimState();
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
                  releaseRewardClaimState();
                });
              },
              completeRunVictory: (materials, onCommit) => {
                handlers.completeRunVictory(materials, () => {
                  onCommit?.();
                  releaseRewardClaimState();
                });
              },
              handleActComplete: (materials) => {
                handlers.handleActComplete(materials, () => {
                  // prepareNextDestination / victory commit overwrite offer state;
                  // only the claim lock must be released here.
                  releaseRewardClaimState();
                });
              },
              labyrinthClearNode: deps.actions.labyrinthClearNode,
              setCompanionRewardCards,
              setRewardState,
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
