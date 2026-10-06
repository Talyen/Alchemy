import { createCorruptionFlowHandlers } from "@/features/alchemy/run-loop/navigation/corruption-flow";
import { createMysteryEventNavigation } from "@/features/alchemy/run-loop/navigation/mystery-event-navigation";
import type { RunFlowShellActions, RunOutcomes } from "@/features/alchemy/run-loop/run/run-flow";
import { createWildwoodGauntletFlow } from "@/features/alchemy/run-loop/run/wildwood-gauntlet-flow";
import { createContentSystemNavigation } from "@/features/alchemy/run-setup/run/content-system-navigation";
import { defaultGameSession } from "@/features/alchemy/shared/stores/default-game-session";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { leaveLabyrinthCorruption } from "@/features/alchemy/shared/stores/navigation-commands";
import { clearBattlePresentationUi, teardownRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { readActiveRun } from "@/features/alchemy/shared/stores/run-reads";
import { sessionFeedback } from "@/features/alchemy/shared/stores/session-capabilities";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { ROUTE_SCREENS } from "@/lib/routing";
import { clearRunCardHover } from "./run-destination-wiring";
import type { RunFlowEngineDeps } from "./shell-types";
export function createRunFlowEngine(
  {
    navigateTo: rawNavigateTo,
    resumeTo: rawResumeTo,
    transition,
    cancelPending,
    battle,
    labyrinthClearNode,
  }: RunFlowEngineDeps,
  outcomes: RunOutcomes,
  gameSession: GameSession = defaultGameSession,
) {
  const clearCardHover = () => clearRunCardHover(gameSession);
  // Universal hover rule (approved): every flow navigation clears card hover
  // unless explicitly opted out. Factories receive the wrapped navigate so
  // Wildwood resume, mystery, and content-system paths cannot leave tooltips.
  const navigateTo: RunFlowEngineDeps["navigateTo"] = (nextScreen, prepareNavigation) => {
    clearCardHover();
    rawNavigateTo(nextScreen, prepareNavigation);
  };
  const resumeTo: RunFlowEngineDeps["resumeTo"] = (nextScreen, prepareNavigation) => {
    clearCardHover();
    rawResumeTo(nextScreen, prepareNavigation);
  };
  const wildwood = createWildwoodGauntletFlow(
    {
      navigateTo,
      resumeTo,
      startBossById: battle.startBossById,
      clearCardHover,
    },
    gameSession,
  );
  const contentNav = createContentSystemNavigation(
    {
      navigateTo,
      resumeTo,
      startBattle: battle.startBattle,
      getAvailableDestinations: outcomes.getAvailableDestinations,
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
    labyrinthClearNode,
    presentBattleStart: battle.presentBattleStart,
    wildwoodRewardComplete: wildwood.handleWildwoodRewardComplete,
    clearCardHover,
  };
  const flowHandlers = outcomes.connect(actions);
  function returnToLabyrinthMap() {
    navigateTo(ROUTE_SCREENS.LABYRINTH_MAP, () => leaveLabyrinthCorruption(gameSession));
  }
  const corruption = createCorruptionFlowHandlers(
    {
      advanceToNextDestination: flowHandlers.advanceToNextDestination,
      returnToCurrentDestination: flowHandlers.returnToCurrentDestination,
      returnToLabyrinthMap,
      isLabyrinthRun: () => readActiveRun(gameSession).contentSystemType === CONTENT_SYSTEMS.LABYRINTH,
    },
    gameSession,
  );
  function resetRunState() {
    cancelPending();
    clearBattlePresentationUi(gameSession);
    // navigateTo already clears card hover via the universal rule above.
    navigateTo(ROUTE_SCREENS.MENU, () => teardownRun(gameSession));
  }
  return {
    getAvailableDestinations: outcomes.getAvailableDestinations,
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
    handleActComplete: flowHandlers.handleActComplete,
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
    // Intentional alias: continuing from a mystery returns to the run flow.
    handleMysteryContinue: flowHandlers.advanceToNextDestination,
    resetRunState,
    // Intentional alias: leaving the run-end screen tears down to menu.
    continueFromRunEnd: resetRunState,
    handleBattleVictory: flowHandlers.handleBattleVictory,
    handleBattleDefeat: flowHandlers.handleBattleDefeat,
  };
}
