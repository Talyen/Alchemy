import type { DestinationOptionsInput } from "@/features/alchemy/shared/run-flow";
import type { BattleStarted } from "@/features/alchemy/shared/stores/battle-start-commands";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { clearBattlePresentationUi } from "@/features/alchemy/shared/stores/run-lifecycle";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import {
  assertSessionOwnership,
  bindSessionCapabilities,
  sessionFeedback,
} from "@/features/alchemy/shared/stores/session-capabilities";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import type { Destination, ScreenTransitionOptions } from "@/lib/routing";
import { ROUTE_SCREENS, type Screen } from "@/lib/routing";
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
    handleActComplete: progression.handleActComplete,
    advanceToNextDestination: progression.advanceToNextDestination,
    returnToCurrentDestination: progression.returnToCurrentDestination,
    handleCampfireContinue: destination.handleCampfireContinue,
  });
}

function createProgressionHandlers(
  deps: RunFlowHandlerDeps,
  completeRunVictory: CompleteRunVictory,
  gameSession: GameSession,
) {
  const commands = createProgressionCommands(deps.getAvailableDestinations, gameSession);
  const prepareDestinationScreen = commands.prepareDestinationScreen;
  function prepareNextDestination(index?: number, onCommitted?: () => void) {
    commands.prepareNextDestination(index);
    deps.actions.navigateTo(ROUTE_SCREENS.DESTINATION, onCommitted);
  }
  function handleActComplete(prepareNavigation?: () => void) {
    const complete = commands.completeAct();
    clearBattlePresentationUi(gameSession);
    if (complete) completeRunVictory(prepareNavigation);
    else prepareNextDestination(0, prepareNavigation);
  }
  function returnToCurrentDestination() {
    commands.leaveCorruption();
    prepareDestinationScreen();
    deps.actions.navigateTo(ROUTE_SCREENS.DESTINATION);
  }
  function advanceToNextDestination() {
    const activity = readRunSession(gameSession).activity.kind;
    if (
      ![
        "campfire",
        "transmutation",
        "shop",
        "alchemist",
        "trinket-shop",
        "equipment-shop",
        "mystery",
        "corruption",
      ].includes(activity)
    )
      return;
    const labyrinth = readActiveRun(gameSession).contentSystemType === CONTENT_SYSTEMS.LABYRINTH;
    commands.completeDestination();
    clearBattlePresentationUi(gameSession);
    deps.actions.navigateTo(labyrinth ? ROUTE_SCREENS.LABYRINTH_MAP : ROUTE_SCREENS.DESTINATION);
  }
  return {
    prepareNextDestination,
    prepareDestinationScreen,
    handleActComplete,
    advanceToNextDestination,
    returnToCurrentDestination,
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
