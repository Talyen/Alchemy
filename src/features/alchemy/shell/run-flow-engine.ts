import { createMysteryEventNavigation } from "@/features/alchemy/run-loop/navigation/mystery-event-navigation";
import { createCorruptionFlowHandlers } from "@/features/alchemy/run-loop/navigation/corruption-flow";
import type { RunFlowShellActions, RunOutcomes } from "@/features/alchemy/run-loop/run/run-flow";
import { createRunFlow } from "@/features/alchemy/run-loop/run/run-flow";
import { createWildwoodGauntletFlow } from "@/features/alchemy/run-loop/run/wildwood-gauntlet-flow";
import { createContentSystemNavigation } from "@/features/alchemy/run-setup/run/content-system-navigation";
import { readActiveRun } from "@/features/alchemy/shared/stores/run-reads";
import {
  createRunSessionCommand,
  dispatchRunSessionCommand,
} from "@/features/alchemy/shared/stores/run-session-command";
import { clearBattlePresentationUi, teardownRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import {
  abandonLabyrinthCorruptionVisit,
  setHasActiveBattle as setDraftHasActiveBattle,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { ROUTE_SCREENS } from "@/lib/routing";
import { createRunDestinationWiring, clearRunCardHover } from "./run-destination-wiring";
import type { RunFlowEngineDeps } from "./shell-types";
export function createRunFlowEngine(
  {
    navigateTo: rawNavigateTo,
    transition,
    cancelPending,
    battle,
    initializeShop,
    labyrinthClearNode,
  }: RunFlowEngineDeps,
  outcomes: RunOutcomes,
) {
  const setHasActiveBattle = createRunSessionCommand(setDraftHasActiveBattle);
  const clearCardHover = clearRunCardHover;
  // Universal hover rule (approved): every flow navigation clears card hover
  // unless explicitly opted out. Factories receive the wrapped navigate so
  // Wildwood resume, mystery, and content-system paths cannot leave tooltips.
  const navigateTo: RunFlowEngineDeps["navigateTo"] = (nextScreen, prepareNavigation) => {
    clearCardHover();
    rawNavigateTo(nextScreen, prepareNavigation);
  };
  const destinations = createRunDestinationWiring({
    navigateTo: rawNavigateTo,
    clearCardHover,
  });
  const wildwood = createWildwoodGauntletFlow({
    navigateTo,
    onStartBossById: battle.onStartBossById,
    setHasActiveBattle,
    clearCardHover,
  });
  const contentNav = createContentSystemNavigation({
    navigateTo,
    onStartBattle: battle.onStartBattle,
    getAvailableDestinations: destinations.getAvailableDestinations,
    onResumeWildwood: wildwood.resumeWildwoodRun,
  });
  const mystery = createMysteryEventNavigation({
    navigateTo,
  });
  const actions: RunFlowShellActions = {
    navigateTo,
    transition,
    labyrinthClearNode,
    initializeShop,
    startBattle: (opts) =>
      battle.onStartBattle(opts?.deck, opts?.gold, opts?.enemyType, opts?.modifiers, opts?.enemyId),
    startBoss: (opts) => {
      if (opts?.bossId && battle.onStartBossById(opts.bossId, opts.modifiers)) return;
      battle.onStartBossBattle();
    },
    beginMysteryEvent: mystery.beginMysteryEvent,
    wildwoodRewardComplete: wildwood.handleWildwoodRewardComplete,
    clearCardHover,
  };
  const flowHandlers = createRunFlow(
    {
      actions,
      getAvailableDestinations: destinations.getAvailableDestinations,
    },
    outcomes,
  );
  function returnToLabyrinthMap() {
    navigateTo(ROUTE_SCREENS.LABYRINTH_MAP, () => {
      dispatchRunSessionCommand((draft) => {
        abandonLabyrinthCorruptionVisit(draft);
      });
    });
  }
  const corruption = createCorruptionFlowHandlers({
    advanceToNextDestination: flowHandlers.advanceToNextDestination,
    returnToCurrentDestination: flowHandlers.returnToCurrentDestination,
    returnToLabyrinthMap,
    isLabyrinthRun: () => readActiveRun().contentSystemType === CONTENT_SYSTEMS.LABYRINTH,
  });
  function resetRunState() {
    cancelPending();
    clearBattlePresentationUi();
    // navigateTo already clears card hover via the universal rule above.
    navigateTo(ROUTE_SCREENS.MENU, teardownRun);
  }
  return {
    getAvailableDestinations: destinations.getAvailableDestinations,
    advanceToNextDestination: flowHandlers.advanceToNextDestination,
    beginCampaign: contentNav.beginCampaign,
    beginLabyrinth: contentNav.beginLabyrinth,
    beginWildwood: contentNav.beginWildwood,
    beginMysteryEvent: mystery.beginMysteryEvent,
    endLabyrinthRun: flowHandlers.endLabyrinthRun,
    handleAbandonRun: () => {
      cancelPending();
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
    goToScreen: destinations.goToScreen,
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
