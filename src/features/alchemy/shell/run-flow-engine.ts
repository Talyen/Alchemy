import { createCorruptionFlowHandlers } from "@/features/alchemy/run-loop/navigation/corruption-flow";
import { createMysteryEventNavigation } from "@/features/alchemy/run-loop/navigation/mystery-event-navigation";
import type { RunFlowShellActions, RunOutcomes } from "@/features/alchemy/run-loop/run/run-flow";
import { createWildwoodGauntletFlow } from "@/features/alchemy/run-loop/run/wildwood-gauntlet-flow";
import { createContentSystemNavigation } from "@/features/alchemy/run-setup/run/content-system-navigation";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { clearBattlePresentationUi, teardownRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { bindSessionCapabilities, sessionFeedback } from "@/features/alchemy/shared/stores/session-capabilities";
import { ROUTE_SCREENS, type Screen, type ScreenTransitionOptions } from "@/lib/routing";
import type { BattleStartCommands } from "@/features/alchemy/shared/stores/battle-start-commands";

/** Command deps for the framework-free flow engine (no display state). */
export interface RunFlowEngineDeps {
  navigateTo: (nextScreen: Screen, prepareNavigation?: () => void) => void;
  resumeTo: (nextScreen: Screen, prepareNavigation?: () => void) => void;
  transition: (nextScreen: Screen, options?: ScreenTransitionOptions) => void;
  cancelPending: () => void;
  battle: BattleStartCommands;
}
export function createRunFlowEngine(input: RunFlowEngineDeps, outcomeInput: RunOutcomes, gameSession: GameSession) {
  const {
    navigateTo: rawNavigateTo,
    resumeTo: rawResumeTo,
    transition,
    cancelPending,
    battle,
  } = bindSessionCapabilities(gameSession, input);
  const outcomes = bindSessionCapabilities(gameSession, outcomeInput);
  const clearCardHover = () => sessionFeedback(gameSession).clearCardHover();
  // Universal hover rule (approved): every flow navigation clears card hover
  // unless explicitly opted out. Factories receive the wrapped navigate so
  // Wildwood resume, mystery, and content-system paths cannot leave tooltips.
  const withHoverCleared = <Args extends unknown[]>(navigate: (...args: Args) => void) => {
    return (...args: Args) => {
      clearCardHover();
      navigate(...args);
    };
  };
  const navigateTo: RunFlowEngineDeps["navigateTo"] = withHoverCleared(rawNavigateTo);
  const resumeTo: RunFlowEngineDeps["resumeTo"] = withHoverCleared(rawResumeTo);
  const wildwood = createWildwoodGauntletFlow(
    {
      navigateTo,
      resumeTo,
      presentBattleStart: battle.presentBattleStart,
      clearCardHover,
    },
    gameSession,
  );
  const contentNav = createContentSystemNavigation(
    {
      navigateTo,
      resumeTo,
      presentBattleStart: battle.presentBattleStart,
      onResumeWildwood: wildwood.resumeWildwoodRun,
    },
    gameSession,
  );
  const mystery = createMysteryEventNavigation(
    {
      navigateTo,
    },
    gameSession,
  );
  const actions: RunFlowShellActions = {
    navigateTo,
    transition,
    presentBattleStart: battle.presentBattleStart,
    clearCardHover,
  };
  const flowHandlers = outcomes.connect(actions);
  const corruption = createCorruptionFlowHandlers(
    { leaveVisit: () => flowHandlers.advanceToNextDestination("corruption") },
    gameSession,
  );
  function resetRunState() {
    cancelPending();
    clearBattlePresentationUi(gameSession);
    // navigateTo already clears card hover via the universal rule above.
    navigateTo(ROUTE_SCREENS.MENU, () => teardownRun(gameSession));
  }
  return bindSessionCapabilities(gameSession, {
    advanceToNextDestination: flowHandlers.advanceToNextDestination,
    beginCampaign: contentNav.beginCampaign,
    beginLabyrinth: contentNav.beginLabyrinth,
    beginWildwood: contentNav.beginWildwood,
    beginMysteryEvent: mystery.beginMysteryEvent,
    endLabyrinthRun: flowHandlers.endLabyrinthRun,
    handleAbandonRun: () => {
      cancelPending();
      sessionFeedback(gameSession).playUISound("destructiveConfirm");
      flowHandlers.handleAbandonRun();
    },
    handleCharacterSelect: contentNav.handleCharacterSelect,
    handleStandardDraftComplete: contentNav.handleStandardDraftComplete,
    handleWildwoodDraftComplete: wildwood.handleWildwoodDraftComplete,
    handleWildwoodDraftPick: wildwood.handleDraftPick,
    handleStarterDraftPick: contentNav.handleStarterDraftPick,
    handleDifficultySelect: contentNav.handleDifficultySelect,
    handleBackFromDifficultySelect: contentNav.handleBackFromDifficultySelect,
    returnToBattle: () => contentNav.resumeRun(),
    goToScreen: navigateTo,
    handleDestinationChoice: flowHandlers.handleDestinationChoice,
    skipRewards: flowHandlers.skipRewards,
    claimRewardChoice: flowHandlers.claimRewardChoice,
    handleWildwoodRemoveCard: wildwood.handleWildwoodRemoveCard,
    handleWildwoodSkipRemoval: wildwood.handleWildwoodSkipRemoval,
    prepareDestinationScreen: flowHandlers.prepareDestinationScreen,
    handleCampfireContinue: flowHandlers.handleCampfireContinue,
    handleCorruptCard: corruption.handleCorruptCard,
    handleCorruptionExit: corruption.handleCorruptionExit,
    handleMysteryChoice: mystery.handleMysteryChoice,
    handleMysteryChooseCard: mystery.handleMysteryChooseCard,
    resetRunState,
    handleBattleVictory: flowHandlers.handleBattleVictory,
    handleBattleDefeat: flowHandlers.handleBattleDefeat,
  });
}
