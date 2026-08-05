import { createEmptyRewardState } from "@/features/alchemy/run-loop/navigation/reward-flow";
import type { RunFlowHandlerDeps } from "@/features/alchemy/run-loop/run/run-flow-handler-deps";
import {
  createRunFlowIntentExecutor,
  type RunFlowIntentExecutorDeps,
} from "@/features/alchemy/shell/create-run-flow-intent-executor";
import type {
  BattleLauncherDeps,
  LabyrinthNavOps,
  MysteryNavOps,
  ShopNavOps,
  WildwoodNavOps,
} from "@/features/alchemy/shell/shell-types";
import { makeRunController, makeTalentController } from "./run-controller";

export type MakeFlowHandlerDepsOverrides = Partial<RunFlowHandlerDeps> &
  Partial<RunFlowIntentExecutorDeps> & {
    onLabyrinthFailNode?: () => void;
    onLabyrinthClearNode?: () => void;
    onInitShop?: () => void;
    onInitAlchemist?: () => void;
    onInitTrinketShop?: () => void;
    onInitEquipmentShop?: () => void;
    onStartBattle?: BattleLauncherDeps["onStartBattle"];
    onStartBossBattle?: BattleLauncherDeps["onStartBossBattle"];
    onStartBossById?: BattleLauncherDeps["onStartBossById"];
    onCommitWildwoodVictory?: WildwoodNavOps["onCommitWildwoodVictory"];
    onWildwoodRewardComplete?: WildwoodNavOps["onWildwoodRewardComplete"];
    onSelectRewardChoice?: WildwoodNavOps["onSelectRewardChoice"];
    beginMysteryEvent?: MysteryNavOps["beginMysteryEvent"];
    clearMysteryCardChoices?: MysteryNavOps["clearMysteryCardChoices"];
  };

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
    labyrinth: labyrinthOverride,
    shop: shopOverride,
    battle: battleOverride,
    wildwood: wildwoodOverride,
    mystery: mysteryOverride,
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

  const labyrinth: LabyrinthNavOps = labyrinthOverride ?? {
    onLabyrinthFailNode,
    onLabyrinthClearNode,
  };

  const shop: ShopNavOps = shopOverride ?? {
    onInitShop,
    onInitAlchemist,
    onInitTrinketShop,
    onInitEquipmentShop,
  };

  const battle: BattleLauncherDeps = battleOverride ?? {
    onStartBattle,
    onStartBossBattle,
    onStartBossById,
  };

  const wildwood: WildwoodNavOps = wildwoodOverride ?? {
    onCommitWildwoodVictory,
    onWildwoodRewardComplete,
    ...(onSelectRewardChoice ? { onSelectRewardChoice } : {}),
  };

  const mystery: MysteryNavOps = mysteryOverride ?? {
    beginMysteryEvent,
    clearMysteryCardChoices,
  };

  const dispatch =
    dispatchOverride ??
    createRunFlowIntentExecutor({
      navigateTo,
      transition,
      labyrinth,
      shop,
      battle,
      wildwood,
      mystery,
      onMarkDifficultyCompleted,
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
