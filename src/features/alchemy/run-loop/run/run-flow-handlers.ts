// Unified run-flow handlers: composes concern modules for victory, defeat, rewards, destinations, and progression.
import type { RunFlowHandlerDeps } from "./run-flow-handler-deps";
import { createRunFlowContext, type RunFlowContinuation } from "./run-flow-context";
import { createVictoryHandlers } from "./run-flow-victory";
import { createDefeatHandlers } from "./run-flow-defeat";
import { createProgressionHandlers } from "./run-flow-progression";
import { createRewardHandlers } from "./run-flow-rewards";
import { createDestinationScreenHandlers } from "./run-flow-destination-screen";
import { awardRunEndMaterials, clearCombatState } from "./run-flow-session-helpers";

export function createRunFlowHandlers(deps: RunFlowHandlerDeps) {
  const dispatchContinuation = (continuation: RunFlowContinuation): void => {
    switch (continuation.type) {
      case "prepare-destination-screen":
        destination.prepareDestinationScreen();
        return;
      case "complete-run-victory":
        defeat.completeRunVictory(continuation.displayMaterials, continuation.onRenderedScreenCommit);
        return;
      case "handle-act-complete":
        progression.handleActComplete(continuation.displayMaterials);
        return;
      case "advance-to-next-destination":
        progression.advanceToNextDestination();
        return;
      default: {
        const _exhaustive: never = continuation;
        void _exhaustive;
      }
    }
  };

  const ctx = createRunFlowContext(deps, dispatchContinuation);

  const victory = createVictoryHandlers(ctx);
  const defeat = createDefeatHandlers(ctx);
  const progression = createProgressionHandlers(ctx);
  const rewards = createRewardHandlers(ctx);
  const destination = createDestinationScreenHandlers(ctx);

  return {
    clearCombatState,
    awardRunEndMaterials,
    commitVictoryResult: victory.commitVictoryResult,
    handleBattleVictory: victory.handleBattleVictory,
    handleBattleDefeat: defeat.handleBattleDefeat,
    handleAbandonRun: defeat.handleAbandonRun,
    finishRewards: rewards.finishRewards,
    selectRewardChoice: rewards.selectRewardChoice,
    prepareDestinationScreen: destination.prepareDestinationScreen,
    handleDestinationChoice: destination.handleDestinationChoice,
    endLabyrinthRun: defeat.endLabyrinthRun,
    handleActComplete: progression.handleActComplete,
    completeRunVictory: defeat.completeRunVictory,
    advanceToNextDestination: progression.advanceToNextDestination,
    handleCampfireContinue: destination.handleCampfireContinue,
  };
}
