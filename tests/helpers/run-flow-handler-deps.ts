import { createEmptyRewardState } from "@/features/alchemy/run-loop/navigation/reward-flow";
import type { RunFlowHandlerDeps } from "@/features/alchemy/run-loop/run/run-flow-handler-deps";
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
    rewardRng: () => 0.5,
    destinationRng: () => 0.5,
    worldRng: () => 0.5,
    ...overrides,
  };
}
