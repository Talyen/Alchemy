// Unified run-flow handlers: composes concern modules for victory, defeat, rewards, destinations, and progression.
import type { RunFlowHandlerDeps, RunFlowSiblingHandlers } from "./run-flow-handler-deps";
import { createVictoryHandlers } from "./run-flow-victory";
import { createDefeatHandlers } from "./run-flow-defeat";
import { createProgressionHandlers } from "./run-flow-progression";
import { createRewardHandlers } from "./run-flow-rewards";
import { createDestinationScreenHandlers } from "./run-flow-destination-screen";
import { awardRunEndMaterials, clearCombatState } from "./run-flow-session-helpers";

export function createRunFlowHandlers(deps: RunFlowHandlerDeps) {
  const victory = createVictoryHandlers(deps);
  const defeat = createDefeatHandlers(deps);

  // Sibling bag is filled after factories return; call sites only run after mount.
  const sibling: RunFlowSiblingHandlers = {
    prepareDestinationScreen: () => {
      throw new Error("prepareDestinationScreen used before run-flow wiring completed");
    },
    completeRunVictory: defeat.completeRunVictory,
    handleActComplete: () => {
      throw new Error("handleActComplete used before run-flow wiring completed");
    },
    advanceToNextDestination: () => {
      throw new Error("advanceToNextDestination used before run-flow wiring completed");
    },
  };

  const progression = createProgressionHandlers(deps, sibling);
  const rewards = createRewardHandlers(deps, sibling);
  const destination = createDestinationScreenHandlers(deps, sibling);

  sibling.prepareDestinationScreen = destination.prepareDestinationScreen;
  sibling.handleActComplete = progression.handleActComplete;
  sibling.advanceToNextDestination = progression.advanceToNextDestination;

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
