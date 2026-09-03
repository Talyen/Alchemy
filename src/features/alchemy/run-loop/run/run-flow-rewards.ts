import { current } from "immer";
import { awardMaterialsDuringRun } from "@/features/alchemy/shared/stores/run-session-write-port";
import {
  beginRewardClaim,
  releaseRewardClaim as releaseRewardClaimState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { createDraftRunRandomSource } from "@/features/alchemy/shared/stores/run-session-write-port";
import { setCompanionRewardCards, setRewardState } from "@/features/alchemy/shared/stores/run-session-write-port";
import { playUISound } from "@/lib/audio";
import {
  finalizeRewardState,
  getActiveRewardModifiersForContentSystem,
  shouldGrantAlchemistReward,
} from "../navigation/reward-flow";
import type { FinalizeRewardResult } from "../navigation/reward-flow-types";
import { applyAlchemistPotion, applyRewardSelection } from "./run-destination-handlers";
import type { CompleteRunVictory, HandleActComplete, RunFlowHandlerDeps } from "./run-flow-handler-deps";
import { REWARD_ROUTES, ROUTE_SCREENS, type Screen } from "@/lib/routing";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";

export interface RewardRouteDeps {
  navigateTo: (screen: Screen, onRenderedScreenCommit?: () => void) => void;
  completeRunVictory: (onRenderedScreenCommit?: () => void) => void;
  handleActComplete: (onRenderedScreenCommit?: () => void) => void;
  labyrinthClearNode: () => void;

  settleClaimSurface: () => void;

  releaseClaim: () => void;
}

export function executeRewardRouteTransition(route: FinalizeRewardResult["route"], deps: RewardRouteDeps) {
  switch (route) {
    case REWARD_ROUTES.COMPANION_REWARD:
      deps.navigateTo(ROUTE_SCREENS.REWARDS, deps.settleClaimSurface);
      break;
    case REWARD_ROUTES.LABYRINTH_VICTORY:
    case REWARD_ROUTES.WILDWOOD_VICTORY:
      deps.completeRunVictory(deps.settleClaimSurface);
      break;
    case REWARD_ROUTES.LABYRINTH_MAP:
      deps.labyrinthClearNode();
      deps.navigateTo(ROUTE_SCREENS.LABYRINTH_MAP, deps.settleClaimSurface);
      break;
    case REWARD_ROUTES.ACT_COMPLETE:
      deps.handleActComplete(deps.releaseClaim);
      break;
    case REWARD_ROUTES.DESTINATION:
      deps.navigateTo(ROUTE_SCREENS.DESTINATION, deps.settleClaimSurface);
      break;
  }
}

interface RewardCallbacks {
  completeRunVictory: CompleteRunVictory;
  handleActComplete: HandleActComplete;
}

export function createRewardHandlers(
  deps: RunFlowHandlerDeps,
  { completeRunVictory, handleActComplete }: RewardCallbacks,
) {
  function selectRewardChoice(id: string) {
    dispatchRunSessionCommand((draft) => {
      setRewardState(draft, (prev) => ({ ...prev, selectedId: id }));
    });
  }

  function finishRewards() {
    dispatchRunSessionCommand(
      (draft) => {
        if (!beginRewardClaim(draft)) return null;
        const session = draft.session;
        const contentSystemType = draft.run.activeRun.contentSystemType;

        const grantAlchemistReward = shouldGrantAlchemistReward(
          getActiveRewardModifiersForContentSystem(
            contentSystemType,
            contentSystemType === CONTENT_SYSTEMS.WILDWOOD
              ? (session.wildwoodDraft?.currentRewardTraitIds ?? [])
              : session.activeLabyrinthRewardModifiers,
          ),
        );
        const result = finalizeRewardState({
          rewardState: current(session.rewardState),
          companionRewardCards: session.companionRewardCards ? current(session.companionRewardCards) : null,
        });

        const isWildwood = contentSystemType === CONTENT_SYSTEMS.WILDWOOD;
        if (!isWildwood) awardMaterialsDuringRun(draft, result.materials);

        if (result.selectedReward) {
          applyRewardSelection({
            reward: result.selectedReward,
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
            dispatchRunSessionCommand((draft) => {
              setRewardState(draft, result.nextRewardState);
              if (result.clearCompanionRewardCards) setCompanionRewardCards(draft, null);
              releaseRewardClaimState(draft);
            });
          };
          const releaseClaim = () => {
            dispatchRunSessionCommand((draft) => {
              releaseRewardClaimState(draft);
            });
          };

          if (result.selectedReward) playUISound("talentUnlock");
          deps.actions.clearCardHover();
          if (isWildwood && result.route !== REWARD_ROUTES.COMPANION_REWARD) {
            deps.actions.wildwoodRewardComplete(settleClaimSurface);
            return;
          }
          executeRewardRouteTransition(result.route, {
            navigateTo: deps.actions.navigateTo,
            completeRunVictory,
            handleActComplete,
            labyrinthClearNode: deps.actions.labyrinthClearNode,
            settleClaimSurface,
            releaseClaim: releaseClaim,
          });
        },
      },
    );
  }

  return {
    selectRewardChoice,
    finishRewards,
  };
}
