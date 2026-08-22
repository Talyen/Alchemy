// Unified run-flow handlers: composes concern modules for victory, defeat, rewards, destinations, and progression.
import type { RunFlowHandlerDeps } from "./run-flow-handler-deps";
import { createVictoryHandlers } from "./run-flow-victory";
import { createDefeatHandlers } from "./run-flow-defeat";
import { createProgressionHandlers } from "./run-flow-progression";
import { createRewardHandlers } from "./run-flow-rewards";
import { createDestinationScreenHandlers } from "./run-flow-destination-screen";

export function createRunFlowHandlers(deps: RunFlowHandlerDeps) {
  const victory = createVictoryHandlers(deps);
  const defeat = createDefeatHandlers(deps);
  const progression = createProgressionHandlers(deps, { completeRunVictory: defeat.completeRunVictory });
  const destination = createDestinationScreenHandlers(deps, {
    advanceToNextDestination: progression.advanceToNextDestination,
  });
  const rewards = createRewardHandlers(deps, {
    completeRunVictory: defeat.completeRunVictory,
    handleActComplete: progression.handleActComplete,
  });

  return {
    handleBattleVictory: victory.handleBattleVictory,
    handleBattleDefeat: defeat.handleBattleDefeat,
    handleAbandonRun: defeat.handleAbandonRun,
    finishRewards: rewards.finishRewards,
    selectRewardChoice: rewards.selectRewardChoice,
    prepareDestinationScreen: progression.prepareDestinationScreen,
    handleDestinationChoice: destination.handleDestinationChoice,
    endLabyrinthRun: defeat.endLabyrinthRun,
    handleActComplete: progression.handleActComplete,
    advanceToNextDestination: progression.advanceToNextDestination,
    returnToCurrentDestination: progression.returnToCurrentDestination,
    handleCampfireContinue: destination.handleCampfireContinue,
  };
}
