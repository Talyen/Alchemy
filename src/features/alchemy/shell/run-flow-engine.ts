import { createMysteryEventNavigation } from "@/features/alchemy/run-loop/navigation/mystery-event-navigation";
import { createCorruptionFlowHandlers } from "@/features/alchemy/run-loop/navigation/run-navigation-corruption";
import type { RunFlowShellActions, RunOutcomes } from "@/features/alchemy/run-loop/run/run-flow";
import { createRunFlow } from "@/features/alchemy/run-loop/run/run-flow";
import { createWildwoodGauntletFlow } from "@/features/alchemy/run-loop/run/wildwood-gauntlet-flow";
import { createContentSystemNavigation } from "@/features/alchemy/run-setup/run/content-system-navigation";
import { readActiveRun } from "@/features/alchemy/shared/stores/run-reads";
import {
  createRunSessionCommand,
  dispatchRunSessionCommand,
} from "@/features/alchemy/shared/stores/run-session-command";
import { clearBattlePresentationUi, teardownRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import {
  abandonLabyrinthCorruptionVisit,
  setHasActiveBattle as setDraftHasActiveBattle,
  setRunDeck,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { ROUTE_SCREENS } from "@/lib/routing";
import { createRunDestinationWiring } from "./run-destination-wiring";
import type { RunNavigationDeps } from "./shell-types";
export function createRunFlowEngine(
  {
    navigateTo,
    transition,
    cancelPending,
    battle,
    initializeShop,
    labyrinthClearNode,
  }: Omit<RunNavigationDeps, "screen">,
  outcomes: RunOutcomes,
) {
  const setHasActiveBattle = createRunSessionCommand(setDraftHasActiveBattle);
  const clearCardHover = () => useUiStore.getState().clearCardHover();
  const destinations = createRunDestinationWiring({
    navigateTo,
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
    clearCardHover,
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
    updateRunDeck: setRunDeck,
    advanceToNextDestination: flowHandlers.advanceToNextDestination,
    returnToCurrentDestination: flowHandlers.returnToCurrentDestination,
    returnToLabyrinthMap,
    isLabyrinthRun: () => readActiveRun().contentSystemType === CONTENT_SYSTEMS.LABYRINTH,
  });
  function resetRunState() {
    cancelPending();
    clearBattlePresentationUi();
    clearCardHover();
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
    handleAbandonRun: flowHandlers.handleAbandonRun,
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
    handleMysteryRemoveCard: mystery.handleMysteryRemoveCard,
    handleMysteryContinue: flowHandlers.advanceToNextDestination,
    resetRunState,
    continueFromRunEnd: resetRunState,
    handleBattleVictory: flowHandlers.handleBattleVictory,
    handleBattleDefeat: flowHandlers.handleBattleDefeat,
  };
}
