import { useMemo, useCallback } from "react";
import {
  useContentNavigationRunPort,
  useContentNavigationTalentPort,
  useTalentEffects,
  useTalentProgressSlice,
} from "@/features/alchemy/shared/stores/run-reads";
import { useSetHasActiveBattle } from "@/features/alchemy/shared/stores/store-actions";
import { useCompletedDifficulties } from "@/features/alchemy/shared/stores/profile-store";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { useRunSessionNavigationSlice } from "@/features/alchemy/shared/stores/run-reads";
import { setRunDeck } from "@/features/alchemy/shared/stores/run-session-write-port";
import { createRunFlowHandlers } from "@/features/alchemy/run-loop/run/run-flow-handlers";
import { createCorruptionFlowHandlers } from "@/features/alchemy/run-loop/navigation/run-navigation-corruption";
import { createRunTeardown } from "@/features/alchemy/run-loop/run/create-run-teardown";
import { useRunDestinationWiring } from "./use-run-destination-wiring";
import { useWildwoodGauntletFlow } from "./use-wildwood-gauntlet-flow";
import { useContentSystemNavigation } from "./use-content-system-navigation";
import { useMysteryEventNavigation } from "./use-mystery-event-navigation";
import type { RunFlowShellActions } from "@/features/alchemy/run-loop/run/run-flow-shell-actions";
import type { RunNavigationDeps } from "./shell-types";

export function useRunFlowEngine({
  screen,
  navigateTo,
  transition,
  cancelPending,
  battle,
  initializeShop,
  labyrinthClearNode,
}: RunNavigationDeps) {
  const orchestration = useContentNavigationRunPort();
  const talentEffects = useTalentEffects();
  const { talentXP } = useTalentProgressSlice();
  const contentTalents = useContentNavigationTalentPort(talentEffects, talentXP);
  const setHasActiveBattle = useSetHasActiveBattle();
  const completedDifficulties = useCompletedDifficulties();
  const nav = useRunSessionNavigationSlice(screen);
  const clearCardHover = useUiStore((s) => s.clearCardHover);

  const runPhase = nav.phase;
  const hasActiveBattle = nav.hasActiveBattle;
  const hasActiveRun = nav.hasActiveRun;
  const pendingCharacterId = nav.pendingCharacterId;
  const pendingContentSystemType = nav.pendingContentSystemType;

  const destinations = useRunDestinationWiring({
    navigateTo,
    clearCardHover,
  });

  const wildwood = useWildwoodGauntletFlow({
    navigateTo,
    onStartBossById: battle.onStartBossById,
    setHasActiveBattle,
    clearCardHover,
  });

  const contentNav = useContentSystemNavigation({
    run: orchestration,
    talents: contentTalents,
    hasActiveRun,
    hasActiveBattle,
    pendingContentSystemType,
    completedDifficulties,
    navigateTo,
    returnToBattle: destinations.returnToBattle,
    onStartBattle: battle.onStartBattle,
    getAvailableDestinations: destinations.getAvailableDestinations,
    onResumeWildwood: wildwood.resumeWildwoodRun,
    clearCardHover,
  });

  const mystery = useMysteryEventNavigation({
    navigateTo,
  });

  const actions = useMemo((): RunFlowShellActions => {
    return {
      navigateTo,
      transition,
      labyrinthClearNode,
      initializeShop,
      startBattle: (opts) => battle.onStartBattle(opts?.deck, opts?.gold, opts?.enemyType),
      startBoss: (opts) => {
        if (opts?.bossId && battle.onStartBossById(opts.bossId, opts.modifiers)) return;
        battle.onStartBossBattle();
      },
      commitWildwoodVictory: wildwood.commitWildwoodVictory,
      beginMysteryEvent: mystery.beginMysteryEvent,
      wildwoodRewardComplete: wildwood.handleWildwoodRewardComplete,
      clearCardHover,
    };
  }, [
    navigateTo,
    transition,
    labyrinthClearNode,
    initializeShop,
    battle,
    wildwood.commitWildwoodVictory,
    wildwood.handleWildwoodRewardComplete,
    mystery.beginMysteryEvent,
    clearCardHover,
  ]);

  const flowHandlers = useMemo(
    () =>
      createRunFlowHandlers({
        actions,
        getAvailableDestinations: destinations.getAvailableDestinations,
      }),
    [actions, destinations.getAvailableDestinations],
  );

  const corruption = useMemo(
    () =>
      createCorruptionFlowHandlers({
        updateRunDeck: setRunDeck,
        advanceToNextDestination: flowHandlers.advanceToNextDestination,
        returnToCurrentDestination: flowHandlers.returnToCurrentDestination,
      }),
    [flowHandlers.advanceToNextDestination, flowHandlers.returnToCurrentDestination],
  );

  const teardown = useMemo(
    () =>
      createRunTeardown({
        cancelPending,
        clearCardHover,
        navigateTo,
      }),
    [cancelPending, clearCardHover, navigateTo],
  );

  const handleMysteryContinue = useCallback(() => {
    flowHandlers.advanceToNextDestination();
  }, [flowHandlers]);

  return useMemo(
    () => ({
      runPhase,
      activeRunData: hasActiveRun,
      pendingCharacterId,
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
      returnToBattle: destinations.returnToBattle,
      goToScreen: destinations.goToScreen,
      handleDestinationChoice: flowHandlers.handleDestinationChoice,
      handleActComplete: flowHandlers.handleActComplete,
      finishRewards: flowHandlers.finishRewards,
      selectRewardChoice: flowHandlers.selectRewardChoice,
      handleWildwoodRemoveCard: wildwood.handleWildwoodRemoveCard,
      handleWildwoodSkipRemoval: wildwood.handleWildwoodSkipRemoval,
      prepareDestinationScreen: flowHandlers.prepareDestinationScreen,
      handleCampfireContinue: flowHandlers.handleCampfireContinue,
      handleCorruptCard: corruption.handleCorruptCard,
      handleCorruptionExit: corruption.handleCorruptionExit,
      handleMysteryChoice: mystery.handleMysteryChoice,
      handleMysteryChooseCard: mystery.handleMysteryChooseCard,
      handleMysteryRemoveCard: mystery.handleMysteryRemoveCard,
      handleMysteryContinue,
      resetRunState: teardown.resetRunState,
      continueFromRunEnd: teardown.continueFromRunEnd,
      handleBattleVictory: flowHandlers.handleBattleVictory,
      handleBattleDefeat: flowHandlers.handleBattleDefeat,
    }),
    [
      runPhase,
      hasActiveRun,
      pendingCharacterId,
      destinations.getAvailableDestinations,
      destinations.returnToBattle,
      destinations.goToScreen,
      flowHandlers,
      contentNav,
      mystery.beginMysteryEvent,
      mystery.handleMysteryChoice,
      mystery.handleMysteryChooseCard,
      mystery.handleMysteryRemoveCard,
      wildwood.handleWildwoodDraftComplete,
      wildwood.handleDraftPick,
      wildwood.handleWildwoodRemoveCard,
      wildwood.handleWildwoodSkipRemoval,
      corruption.handleCorruptCard,
      corruption.handleCorruptionExit,
      handleMysteryContinue,
      teardown.resetRunState,
      teardown.continueFromRunEnd,
    ],
  );
}
