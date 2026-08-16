// Consolidated Run Flow Engine hook for Alchemy shell navigation and sub-system flow routing.
import { useMemo, useCallback } from "react";
import {
  useRunOrchestrationPort,
  useRunFlowTalentPort,
  useContentNavigationTalentPort,
  useTalentEffects,
  useTalentProgressSlice,
  useSetHasActiveBattle,
} from "@/features/alchemy/shared/stores/run-session-react-ports";
import { useCompletedDifficulties } from "@/features/alchemy/shared/stores/profile-store";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { useRunSessionNavigationSlice } from "@/features/alchemy/shared/stores/run-session-model";
import { readActiveRun } from "@/features/alchemy/shared/stores/run-session-read-port";
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
  labyrinthFailNode,
  onMarkDifficultyCompleted,
}: RunNavigationDeps) {
  const orchestration = useRunOrchestrationPort();
  const talentEffects = useTalentEffects();
  const { talentXP } = useTalentProgressSlice();
  const flowTalents = useRunFlowTalentPort(talentEffects);
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
    run: orchestration,
    hasActiveBattle,
    navigateTo,
    clearCardHover,
  });

  const wildwood = useWildwoodGauntletFlow({
    run: orchestration,
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
      labyrinthFailNode,
      labyrinthClearNode,
      initializeShop,
      startBattle: (opts) => battle.onStartBattle(opts?.deck, opts?.gold, opts?.enemyType),
      startBoss: (opts) => {
        if (opts?.bossId && battle.onStartBossById(opts.bossId, opts.modifiers)) return;
        battle.onStartBossBattle();
      },
      markDifficultyCompleted: onMarkDifficultyCompleted,
      commitWildwoodVictory: wildwood.commitWildwoodVictory,
      beginMysteryEvent: mystery.beginMysteryEvent,
      clearMysteryCardChoices: mystery.clearCardChoices,
      wildwoodRewardComplete: wildwood.handleWildwoodRewardComplete,
      selectRewardChoice: wildwood.selectRewardChoice,
    };
  }, [
    navigateTo,
    transition,
    labyrinthFailNode,
    labyrinthClearNode,
    initializeShop,
    battle,
    onMarkDifficultyCompleted,
    wildwood.commitWildwoodVictory,
    wildwood.handleWildwoodRewardComplete,
    wildwood.selectRewardChoice,
    mystery.beginMysteryEvent,
    mystery.clearCardChoices,
  ]);

  const flowHandlers = useMemo(
    () =>
      createRunFlowHandlers({
        run: orchestration,
        talents: flowTalents,
        actions,
        getAvailableDestinations: destinations.getAvailableDestinations,
      }),
    [orchestration, flowTalents, actions, destinations.getAvailableDestinations],
  );

  const corruption = useMemo(
    () =>
      createCorruptionFlowHandlers({
        getRunDeck: () => readActiveRun().runDeck,
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

  return {
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
    handleDraftPick: wildwood.handleDraftPick,
    handleDifficultySelect: contentNav.handleDifficultySelect,
    handleBackFromDifficultySelect: contentNav.handleBackFromDifficultySelect,
    returnToBattle: destinations.returnToBattle,
    goToScreen: destinations.goToScreen,
    handleDestinationChoice: flowHandlers.handleDestinationChoice,
    handleActComplete: flowHandlers.handleActComplete,
    finishRewards: flowHandlers.finishRewards,
    selectRewardChoice: flowHandlers.selectRewardChoice,
    handleWildwoodRecoveryComplete: wildwood.handleWildwoodRecoveryComplete,
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
  };
}
