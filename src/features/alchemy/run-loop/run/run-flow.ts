import { assertSessionOwnership, bindSessionCapabilities } from "@/features/alchemy/shared/stores/session-capabilities";
import type { DestinationOptionsInput } from "@/features/alchemy/shared/run-flow";
import type { BattleStarted } from "@/features/alchemy/shared/stores/battle-start-commands";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
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
  presentBattleStart: (result: BattleStarted) => void;
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

export function createRunOutcomes(deps: RunOutcomeDeps, gameSession: GameSession) {
  assertSessionOwnership(gameSession, deps.actions, deps.getAvailableDestinations);
  const victory = createVictoryHandlers(deps, gameSession);
  const defeat = createDefeatHandlers(deps, gameSession);
  return bindSessionCapabilities(gameSession, {
    victory,
    defeat,
    getAvailableDestinations: deps.getAvailableDestinations,
    connect(actions: RunFlowShellActions) {
      assertSessionOwnership(gameSession, actions);
      return composeRunFlow(
        { actions, getAvailableDestinations: deps.getAvailableDestinations },
        { victory, defeat },
        gameSession,
      );
    },
  });
}

export type RunOutcomes = ReturnType<typeof createRunOutcomes>;

export function createRunFlow(deps: RunFlowHandlerDeps, gameSession: GameSession) {
  return createRunOutcomes(deps, gameSession).connect(deps.actions);
}

function composeRunFlow(
  deps: RunFlowHandlerDeps,
  outcomes: Pick<RunOutcomes, "victory" | "defeat">,
  gameSession: GameSession,
) {
  const { victory, defeat } = outcomes;
  const progression = createProgressionHandlers(deps, victory.completeRunVictory, gameSession);
  const destination = createDestinationScreenHandlers(deps, progression.advanceToNextDestination, gameSession);
  const rewards = createRewardHandlers(
    deps,
    {
      completeRunVictory: victory.completeRunVictory,
      handleActComplete: progression.handleActComplete,
    },
    gameSession,
  );

  return bindSessionCapabilities(gameSession, {
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
  });
}
