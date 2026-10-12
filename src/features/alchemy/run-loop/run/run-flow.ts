import type { DestinationOptionsInput } from "@/features/alchemy/shared/run-flow";
import type { BattleStarted } from "@/features/alchemy/shared/stores/battle-start-commands";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { clearBattlePresentationUi } from "@/features/alchemy/shared/stores/run-lifecycle";
import {
  assertSessionOwnership,
  bindSessionCapabilities,
  sessionFeedback,
} from "@/features/alchemy/shared/stores/session-capabilities";
import type { Destination, Screen, ScreenTransitionOptions } from "@/lib/routing";
import { createProgressionCommands } from "./progression-commands";
import { claimRunReward, finishRewardClaim } from "./reward-commands";
import { createDefeatHandlers } from "./run-flow-defeat";
import { createDestinationScreenHandlers } from "./run-flow-destination-screen";
import { createVictoryHandlers } from "./run-flow-victory";

export interface RunFlowShellActions {
  navigateTo: (screen: Screen, prepareNavigation?: () => void) => void;
  transition: (screen: Screen, options?: ScreenTransitionOptions) => void;
  presentBattleStart: (result: BattleStarted) => void;
  clearCardHover: () => void;
}

type CompleteRunVictory = (prepareNavigation?: () => void) => void;

export type AdvanceToNextDestination = (expectedActivity: Screen) => void;

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
  const progression = createProgressionHandlers(deps, gameSession);
  const destination = createDestinationScreenHandlers(deps, progression.advanceToNextDestination, gameSession);
  const rewards = createRewardHandlers(deps, victory.completeRunVictory, gameSession);

  return bindSessionCapabilities(gameSession, {
    handleBattleVictory: victory.handleBattleVictory,
    handleBattleDefeat: defeat.handleBattleDefeat,
    handleAbandonRun: defeat.handleAbandonRun,
    skipRewards: rewards.skipRewards,
    claimRewardChoice: rewards.claimRewardChoice,
    prepareDestinationScreen: progression.prepareDestinationScreen,
    handleDestinationChoice: destination.handleDestinationChoice,
    endLabyrinthRun: defeat.endLabyrinthRun,
    advanceToNextDestination: progression.advanceToNextDestination,
    handleCampfireContinue: destination.handleCampfireContinue,
  });
}

function createProgressionHandlers(deps: RunFlowHandlerDeps, gameSession: GameSession) {
  const commands = createProgressionCommands(deps.getAvailableDestinations, gameSession);
  function advanceToNextDestination(expectedActivity: Screen) {
    const nextScreen = commands.leaveVisit(expectedActivity);
    if (!nextScreen) return;
    clearBattlePresentationUi(gameSession);
    deps.actions.navigateTo(nextScreen);
  }
  return {
    prepareDestinationScreen: commands.prepareDestinationScreen,
    advanceToNextDestination,
  };
}

function createRewardHandlers(
  deps: RunFlowHandlerDeps,
  completeRunVictory: CompleteRunVictory,
  gameSession: GameSession,
) {
  function finishRewards(choiceId: string | null) {
    const commit = claimRunReward(choiceId, gameSession, deps.getAvailableDestinations);
    if (!commit) return;
    const releaseClaim = () => finishRewardClaim(gameSession);
    if (commit.result.selectedReward) sessionFeedback(gameSession).playUISound("talentUnlock");
    deps.actions.clearCardHover();
    if (commit.runEnded) completeRunVictory(releaseClaim);
    else {
      deps.actions.navigateTo(commit.nextScreen, releaseClaim);
      if (commit.battleStarted) deps.actions.presentBattleStart(commit.battleStarted);
    }
  }

  return {
    claimRewardChoice: (id: string) => finishRewards(id),
    skipRewards: () => finishRewards(null),
  };
}
