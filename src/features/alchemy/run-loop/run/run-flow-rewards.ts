import { current } from "immer";
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
import {
  setCompanionRewardCards,
  setRewardState,
  setWildwoodDraft,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { playUISound } from "@/lib/audio";
import {
  finalizeRewardState,
  getActiveRewardModifiersForContentSystem,
  shouldGrantAlchemistReward,
} from "../navigation/reward-flow";
import type { FinalizeRewardResult } from "../navigation/reward-flow-types";
import { applyAlchemistPotion, applyRewardSelection } from "./run-destination-handlers";
import { CONSTANTS } from "../../shared/types";
import type { CompleteRunVictory, HandleActComplete, RunFlowHandlerDeps } from "./run-flow-handler-deps";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { Screen } from "@/lib/routing";

export interface RewardRouteDeps {
  navigateTo: (screen: Screen, onRenderedScreenCommit?: () => void) => void;
  completeRunVictory: (materials: MaterialInventory, onRenderedScreenCommit?: () => void) => void;
  handleActComplete: (materials: MaterialInventory, onRenderedScreenCommit?: () => void) => void;
  labyrinthClearNode: () => void;
  /** Commit hook for most routes: restores the settled reward surface and releases the claim. */
  settleClaimSurface: () => void;
  /** Claim-only release for ACT_COMPLETE, whose successor overwrites the reward surface anyway. */
  releaseClaim: () => void;
}

export function executeRewardRouteTransition(
  route: FinalizeRewardResult["route"],
  materials: MaterialInventory,
  deps: RewardRouteDeps,
) {
  switch (route) {
    case CONSTANTS.REWARD_ROUTES.COMPANION_REWARD:
      deps.navigateTo(CONSTANTS.SCREENS.REWARDS, deps.settleClaimSurface);
      break;
    case CONSTANTS.REWARD_ROUTES.LABYRINTH_VICTORY:
    case CONSTANTS.REWARD_ROUTES.WILDWOOD_VICTORY:
      deps.completeRunVictory(materials, deps.settleClaimSurface);
      break;
    case CONSTANTS.REWARD_ROUTES.LABYRINTH_MAP:
      deps.labyrinthClearNode();
      deps.navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP, deps.settleClaimSurface);
      break;
    case CONSTANTS.REWARD_ROUTES.ACT_COMPLETE:
      // prepareNextDestination / victory commit overwrite offer state;
      // only the claim lock must be released here.
      deps.handleActComplete(materials, deps.releaseClaim);
      break;
    case CONSTANTS.REWARD_ROUTES.DESTINATION:
      deps.navigateTo(CONSTANTS.SCREENS.DESTINATION, deps.settleClaimSurface);
      break;
  }
}

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
    dispatchRunSessionCommand((draft) => {
      setRewardState(draft, (prev) => ({ ...prev, selectedId: id }));
      if (draft.run.activeRun.contentSystemType !== CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) return;
      const state = draft.session.wildwoodDraft;
      if (!state) return;
      setWildwoodDraft(draft, { ...state, selectedRewardId: id });
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
            contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD
              ? (session.wildwoodDraft?.currentRewardTraitIds ?? [])
              : session.activeLabyrinthRewardModifiers,
          ),
        );
        const result = finalizeRewardState({
          rewardState: current(session.rewardState),
          companionRewardCards: session.companionRewardCards ? current(session.companionRewardCards) : null,
        });

        // Keep the live offer UI until onRenderedScreenCommit so Victory does not
        // hollow during NAVIGATION_DELAY_MS + PAGE_EXIT_MS. Mid-claim autosave
        // persists companion handoff or destination continuation (not the claimed primary).

        const isWildwood = contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD;
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

          // Single commit hook for every route: restores the settled reward
          // surface (next state + companion handoff clear) and releases the claim.
          const settleClaimSurface = () => {
            commandSetRewardState(result.nextRewardState);
            if (result.clearCompanionRewardCards) commandSetCompanionRewardCards(null);
            commandReleaseRewardClaim();
          };

          if (result.selectedChoice) playUISound("talentUnlock");
          deps.actions.clearCardHover();
          if (isWildwood && result.route !== CONSTANTS.REWARD_ROUTES.COMPANION_REWARD) {
            deps.actions.wildwoodRewardComplete(settleClaimSurface);
            return;
          }
          executeRewardRouteTransition(result.route, result.materials, {
            navigateTo: deps.actions.navigateTo,
            completeRunVictory,
            handleActComplete,
            labyrinthClearNode: deps.actions.labyrinthClearNode,
            settleClaimSurface,
            releaseClaim: commandReleaseRewardClaim,
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
