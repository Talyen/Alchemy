// Unified run-flow handlers: composes concern modules for victory, defeat, rewards, destinations, and progression.
import type { RunFlowHandlerDeps } from "./run-flow-handler-deps";
import { createRunFlowContext } from "./run-flow-context";
import { createVictoryHandlers } from "./run-flow-victory";
import { createDefeatHandlers } from "./run-flow-defeat";
import { createProgressionHandlers } from "./run-flow-progression";
import { createRewardHandlers } from "./run-flow-rewards";
import { createDestinationScreenHandlers } from "./run-flow-destination-screen";
import { awardRunEndMaterials, clearCombatState } from "./run-flow-session-helpers";

export function createRunFlowHandlers(deps: RunFlowHandlerDeps) {
  const ctx = createRunFlowContext(deps);

  const victory = createVictoryHandlers(ctx);
  const defeat = createDefeatHandlers(ctx);
  const progression = createProgressionHandlers(ctx);
  const rewards = createRewardHandlers(ctx);
  const destination = createDestinationScreenHandlers(ctx);

  ctx.prepareDestinationScreen = destination.prepareDestinationScreen;
  ctx.completeRunVictory = defeat.completeRunVictory;
  ctx.handleActComplete = progression.handleActComplete;
  ctx.advanceToNextDestination = progression.advanceToNextDestination;
  ctx.endLabyrinthRun = defeat.endLabyrinthRun;
  ctx.endRunAndShowGameOver = defeat.endRunAndShowGameOver;

  return {
    clearCombatState,
    awardRunEndMaterials,
    computeVictoryResult: victory.computeVictoryResult,
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
