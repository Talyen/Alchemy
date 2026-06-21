import { createEmptyRewardState } from "@/features/alchemy/run-loop/navigation/reward-flow";
import type { RunFlowHandlerDeps } from "@/features/alchemy/run-loop/run/run-flow-handlers";
import { makeRunController, makeTalentController } from "./run-controller";

export function makeFlowHandlerDeps(overrides: Partial<RunFlowHandlerDeps> = {}): RunFlowHandlerDeps {
  return {
    run: makeRunController(),
    talents: makeTalentController(),
    navigateTo: () => {},
    transition: () => {},
    onLabyrinthFailNode: () => {},
    onLabyrinthClearNode: () => {},
    onInitShop: () => {},
    onInitAlchemist: () => {},
    onInitTrinketShop: () => {},
    onInitEquipmentShop: () => {},
    onStartBattle: () => {},
    onStartBossBattle: () => {},
    onStartBossById: () => true,
    onMarkDifficultyCompleted: () => {},
    onCommitWildwoodVictory: () => {},
    contentNav: {
      createInitialDestinations: () => createEmptyRewardState(),
    },
    getAvailableDestinations: () => [],
    beginMysteryEvent: () => {},
    clearMysteryCardChoices: () => {},
    onWildwoodRewardComplete: () => {},
    ...overrides,
  };
}
