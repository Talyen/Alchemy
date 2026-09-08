import type { BattleCard, DifficultyModifier } from "@/lib/game-data";
import type { VictoryRewardsResult } from "../navigation/victory-flow";
import type { Screen, ScreenTransitionOptions, Destination } from "@/lib/routing";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import type { DestinationOptionsInput } from "@/features/alchemy/shared/run-flow";
import type { ShopKind } from "@/features/alchemy/run-loop/shop/shop-action-types";
import { createVictoryHandlers } from "./run-flow-victory";
import { createDefeatHandlers } from "./run-flow-defeat";
import { createProgressionHandlers } from "./run-flow-progression";
import { createRewardHandlers } from "./run-flow-rewards";
import { createDestinationScreenHandlers } from "./run-flow-destination-screen";

export interface RunFlowShellActions {
  navigateTo: (screen: Screen, onRenderedScreenCommit?: () => void) => void;
  transition: (screen: Screen, options?: ScreenTransitionOptions) => void;
  labyrinthClearNode: () => void;
  initializeShop: (kind: ShopKind) => void;
  startBattle: (opts?: {
    deck?: BattleCard[];
    gold?: number;
    enemyType?: "normal" | "elite";
    modifiers?: DifficultyModifier[];
    enemyId?: string;
  }) => void;

  startBoss: (opts?: { bossId?: string | null; modifiers?: DifficultyModifier[] }) => void;

  commitWildwoodVictory: (draft: GameplayDraft, result: VictoryRewardsResult) => void;
  beginMysteryEvent: (onRenderedScreenCommit?: () => void) => void;
  wildwoodRewardComplete: (onRenderedScreenCommit?: () => void) => void;
  clearCardHover: () => void;
}

export type CompleteRunVictory = (onRenderedScreenCommit?: () => void) => void;

export type HandleActComplete = (onRenderedScreenCommit?: () => void) => void;

export type AdvanceToNextDestination = () => void;

export interface RunFlowHandlerDeps {
  actions: RunFlowShellActions;
  getAvailableDestinations: (options?: DestinationOptionsInput) => Destination[];
}

export function createRunFlow(deps: RunFlowHandlerDeps) {
  const victory = createVictoryHandlers(deps);
  const defeat = createDefeatHandlers(deps);
  const progression = createProgressionHandlers(deps, victory.completeRunVictory);
  const destination = createDestinationScreenHandlers(deps, progression.advanceToNextDestination);
  const rewards = createRewardHandlers(deps, {
    completeRunVictory: victory.completeRunVictory,
    handleActComplete: progression.handleActComplete,
  });

  return {
    handleBattleVictory: victory.handleBattleVictory,
    handleBattleDefeat: defeat.handleBattleDefeat,
    handleAbandonRun: defeat.handleAbandonRun,
    skipRewards: rewards.skipRewards,
    claimRewardChoice: rewards.claimRewardChoice,
    prepareDestinationScreen: progression.prepareDestinationScreen,
    handleDestinationChoice: destination.handleDestinationChoice,
    endLabyrinthRun: defeat.endLabyrinthRun,
    handleActComplete: progression.handleActComplete,
    advanceToNextDestination: progression.advanceToNextDestination,
    returnToCurrentDestination: progression.returnToCurrentDestination,
    handleCampfireContinue: destination.handleCampfireContinue,
  };
}
