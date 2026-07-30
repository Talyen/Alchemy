import {
  readRunSessionStore,
  awardMaterialsDuringRun,
  beginRewardClaim,
  releaseRewardClaim as releaseRewardClaimState,
  runSessionTransaction,
} from "../../shared/stores/run-session-facade";
import { setCompanionRewardCards, setRewardState } from "../../shared/stores/run-session-facade";
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
import { getActiveRewardTraits } from "./run-flow-handler-deps";
import type { RunFlowContext } from "./run-flow-context";

export function createRewardHandlers(ctx: RunFlowContext) {
  const { deps } = ctx;

  function selectRewardChoice(id: string) {
    setRewardState((prev) => ({ ...prev, selectedId: id }));
    deps.dispatch({ type: "select-reward-choice", id });
  }

  function finishRewards() {
    runSessionTransaction(
      () => {
        if (!beginRewardClaim()) return null;
        const session = readRunSessionStore();

        const grantAlchemistReward = shouldGrantAlchemistReward(
          getActiveRewardModifiersForContentSystem(
            deps.run.contentSystemType,
            getActiveRewardTraits(deps.run.contentSystemType),
          ),
        );
        const result = finalizeRewardState({
          rewardState: session.rewardState,
          companionRewardCards: session.companionRewardCards,
        });

        // Apply the post-claim persistable surface immediately so autosave cannot
        // snapshot an empty rewards screen. Companion route keeps choices (the
        // companion offer); other routes keep destinations with choices cleared.
        setRewardState(result.nextRewardState);
        if (result.clearCompanionRewardCards) setCompanionRewardCards(null);

        const isWildwood = deps.run.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD;
        if (!isWildwood) awardMaterialsDuringRun(result.materials);

        if (result.selectedChoice) {
          applyRewardSelection({
            choice: result.selectedChoice,
            type: result.selectedRewardType,
            setRunDeck: deps.run.setRunDeck,
            setRunTrinkets: deps.run.setRunTrinkets,
          });
        }
        if (grantAlchemistReward) {
          applyAlchemistPotion({ setRunDeck: deps.run.setRunDeck, rng: deps.rewardRng });
        }

        return { result, isWildwood };
      },
      {
        afterCommit: (commit) => {
          if (!commit) return;
          const { result, isWildwood } = commit;
          const releaseRewardClaim = () => releaseRewardClaimState();

          if (result.selectedChoice) playUISound("talentUnlock");
          useUiStore.getState().clearCardHover();
          if (isWildwood && result.route !== CONSTANTS.REWARD_ROUTES.COMPANION_REWARD) {
            releaseRewardClaim();
            deps.dispatch({ type: "wildwood-reward-complete" });
            return;
          }
          executeRewardRouteTransition(
            result.route,
            result.materials,
            result.nextRewardState,
            false, // companion cards already cleared above when needed
            {
              navigateTo: (screen, onCommit) => {
                deps.dispatch({
                  type: "navigate",
                  screen,
                  onRenderedScreenCommit: () => {
                    releaseRewardClaim();
                    onCommit?.();
                  },
                });
              },
              completeRunVictory: (materials, onCommit) => {
                ctx.completeRunVictory(materials, () => {
                  releaseRewardClaim();
                  onCommit?.();
                });
              },
              handleActComplete: (materials) => {
                releaseRewardClaim();
                ctx.handleActComplete(materials);
              },
              onLabyrinthClearNode: () => deps.dispatch({ type: "labyrinth-clear-node" }),
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
