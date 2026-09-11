import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { releaseRewardClaim as releaseRewardClaimState } from "@/features/alchemy/shared/stores/run-session-write-port";
import { playUISound } from "@/lib/audio";
import { REWARD_ROUTES, ROUTE_SCREENS, type Screen } from "@/lib/routing";
import type { FinalizeRewardResult } from "../navigation/reward-flow";
import { claimRunReward } from "./reward-commands";
import type { CompleteRunVictory, HandleActComplete, RunFlowHandlerDeps } from "./run-flow";

export interface RewardRouteDeps {
  navigateTo: (screen: Screen, prepareNavigation?: () => void) => void;
  completeRunVictory: (prepareNavigation?: () => void) => void;
  handleActComplete: (prepareNavigation?: () => void) => void;
  labyrinthClearNode: () => void;

  releaseClaim: () => void;
}

export function executeRewardRouteTransition(route: FinalizeRewardResult["route"], deps: RewardRouteDeps) {
  switch (route) {
    case REWARD_ROUTES.COMPANION_REWARD:
      deps.navigateTo(ROUTE_SCREENS.REWARDS, deps.releaseClaim);
      break;
    case REWARD_ROUTES.LABYRINTH_VICTORY:
    case REWARD_ROUTES.WILDWOOD_VICTORY:
      deps.completeRunVictory(deps.releaseClaim);
      break;
    case REWARD_ROUTES.LABYRINTH_MAP:
      deps.labyrinthClearNode();
      deps.navigateTo(ROUTE_SCREENS.LABYRINTH_MAP, deps.releaseClaim);
      break;
    case REWARD_ROUTES.ACT_COMPLETE:
      deps.handleActComplete(deps.releaseClaim);
      break;
    case REWARD_ROUTES.DESTINATION:
      deps.navigateTo(ROUTE_SCREENS.DESTINATION, deps.releaseClaim);
      break;
  }
}

export function createRewardHandlers(
  deps: RunFlowHandlerDeps,
  {
    completeRunVictory,
    handleActComplete,
  }: { completeRunVictory: CompleteRunVictory; handleActComplete: HandleActComplete },
) {
  function finishRewards(choiceId: string | null) {
    const commit = claimRunReward(choiceId);
    if (!commit) return;
    const { result, isWildwood } = commit;

    const releaseClaim = () => {
      dispatchRunSessionCommand((draft) => {
        releaseRewardClaimState(draft);
      });
    };

    if (result.selectedReward) playUISound("talentUnlock");
    deps.actions.clearCardHover();
    if (isWildwood && result.route !== REWARD_ROUTES.COMPANION_REWARD) {
      deps.actions.wildwoodRewardComplete(releaseClaim);
      return;
    }
    executeRewardRouteTransition(result.route, {
      navigateTo: deps.actions.navigateTo,
      completeRunVictory,
      handleActComplete,
      labyrinthClearNode: deps.actions.labyrinthClearNode,
      releaseClaim,
    });
  }

  return {
    claimRewardChoice: (id: string) => finishRewards(id),
    skipRewards: () => finishRewards(null),
  };
}
