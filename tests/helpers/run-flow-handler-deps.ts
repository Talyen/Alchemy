import { createEmptyRewardState } from "@/features/alchemy/run-loop/navigation/reward-flow";
import type { RunFlowHandlerDeps } from "@/features/alchemy/run-loop/run/run-flow-handler-deps";
import {
  createRunFlowIntentExecutor,
  type RunFlowIntentExecutorDeps,
} from "@/features/alchemy/shell/create-run-flow-intent-executor";
import { makeRunController, makeTalentController } from "./run-controller";

export type MakeFlowHandlerDepsOverrides = Partial<RunFlowHandlerDeps> & Partial<RunFlowIntentExecutorDeps>;

/**
 * Builds RunFlowHandlerDeps for tests. Convenience stubs (navigateTo, onInitShop, …)
 * are wired into a default intent executor when `dispatch` is omitted.
 */
export function makeFlowHandlerDeps(overrides: MakeFlowHandlerDepsOverrides = {}): RunFlowHandlerDeps {
  const {
    run = makeRunController(),
    talents = makeTalentController(),
    contentNav = {
      createInitialDestinations: () => ({
        rewardState: createEmptyRewardState(),
        offerState: { lastOfferedDestinations: [], roundsSinceOffered: {} },
      }),
    },
    getAvailableDestinations = () => [],
    rewardRng = () => 0.5,
    destinationRng = () => 0.5,
    worldRng = () => 0.5,
    dispatch: dispatchOverride,
    navigateTo = () => {},
    transition = () => {},
    onLabyrinthFailNode = () => {},
    onLabyrinthClearNode = () => {},
    onInitShop = () => {},
    onInitAlchemist = () => {},
    onInitTrinketShop = () => {},
    onInitEquipmentShop = () => {},
    onStartBattle = () => {},
    onStartBossBattle = () => {},
    onStartBossById = () => true,
    onMarkDifficultyCompleted = () => {},
    onCommitWildwoodVictory = () => {},
    beginMysteryEvent = () => {},
    clearMysteryCardChoices = () => {},
    onWildwoodRewardComplete = () => {},
    onSelectRewardChoice,
  } = overrides;

  const dispatch =
    dispatchOverride ??
    createRunFlowIntentExecutor({
      navigateTo,
      transition,
      onLabyrinthFailNode,
      onLabyrinthClearNode,
      onInitShop,
      onInitAlchemist,
      onInitTrinketShop,
      onInitEquipmentShop,
      onStartBattle,
      onStartBossBattle,
      onStartBossById,
      onMarkDifficultyCompleted,
      onCommitWildwoodVictory,
      beginMysteryEvent,
      clearMysteryCardChoices,
      onWildwoodRewardComplete,
      ...(onSelectRewardChoice ? { onSelectRewardChoice } : {}),
    });

  return {
    run,
    talents,
    dispatch,
    contentNav,
    getAvailableDestinations,
    rewardRng,
    destinationRng,
    worldRng,
  };
}
