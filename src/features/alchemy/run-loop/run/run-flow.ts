import type { ShopKind } from "@/features/alchemy/run-loop/shop/shop-action-types";
import type { DestinationOptionsInput } from "@/features/alchemy/shared/run-flow";
import type { BattleCard, DifficultyModifier } from "@/lib/game-data";
import type { Destination, Screen, ScreenTransitionOptions } from "@/lib/routing";
import { createDefeatHandlers } from "./run-flow-defeat";
import { createDestinationScreenHandlers } from "./run-flow-destination-screen";
import { createProgressionHandlers } from "./run-flow-progression";
import { createRewardHandlers } from "./run-flow-rewards";
import { createVictoryHandlers } from "./run-flow-victory";

export interface RunFlowShellActions {
  navigateTo: (screen: Screen, prepareNavigation?: () => void) => void;
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

  beginMysteryEvent: (prepareNavigation?: () => void) => void;
  wildwoodRewardComplete: (prepareNavigation?: () => void) => void;
  clearCardHover: () => void;
}

export type CompleteRunVictory = (prepareNavigation?: () => void) => void;

export type HandleActComplete = (prepareNavigation?: () => void) => void;

export type AdvanceToNextDestination = () => void;

export interface RunFlowHandlerDeps {
  actions: RunFlowShellActions;
  getAvailableDestinations: (options?: DestinationOptionsInput) => Destination[];
}

export interface RunOutcomeDeps {
  actions: Pick<RunFlowShellActions, "navigateTo" | "transition" | "clearCardHover">;
  getAvailableDestinations: RunFlowHandlerDeps["getAvailableDestinations"];
}

export function createRunOutcomes(deps: RunOutcomeDeps) {
  return { victory: createVictoryHandlers(deps), defeat: createDefeatHandlers(deps) };
}

export type RunOutcomes = ReturnType<typeof createRunOutcomes>;

export function createRunFlow(deps: RunFlowHandlerDeps, outcomes = createRunOutcomes(deps)) {
  const { victory, defeat } = outcomes;
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
