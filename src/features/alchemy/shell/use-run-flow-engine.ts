// Consolidated Run Flow Engine hook for Alchemy shell navigation and sub-system flow routing.
import { useMemo, useCallback } from "react";
import {
  useRunFlowRunPort,
  useRunFlowTalentPort,
  useContentNavigationRunPort,
  useContentNavigationTalentPort,
  useWildwoodRunPort,
  useCorruptionRunPort,
  useDestinationRunPort,
  useSetHasActiveBattle,
} from "@/features/alchemy/shared/stores/run-session-react-ports";
import { useCompletedDifficulties } from "@/features/alchemy/shared/stores/profile-port";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { useRunSessionNavigationSlice } from "@/features/alchemy/shared/stores/run-session-model";
import { CONSTANTS } from "@/features/alchemy/shared/types";
import type { BattleCard } from "@/lib/game-data";
import { useRunDestinationWiring } from "./use-run-destination-wiring";
import { useWildwoodGauntletFlow } from "./use-wildwood-gauntlet-flow";
import { useContentSystemNavigation } from "./use-content-system-navigation";
import { useMysteryEventNavigation } from "./use-mystery-event-navigation";
import { useRunCorruptionFlow } from "./use-run-corruption-flow";
import { useRunFlowHandlers } from "./use-run-flow-handlers";
import { useRunTeardown } from "./use-run-teardown";
import { createRunFlowIntentExecutor } from "./create-run-flow-intent-executor";
import type { RunNavigationDeps } from "./shell-types";

export function useRunFlowEngine({
  screen,
  navigateTo,
  transition,
  cancelPending,
  battle,
  labyrinth,
  shop,
  wildwood: wildwoodOverride,
  mystery: mysteryOverride,
  onMarkDifficultyCompleted,
  randomSources,
}: RunNavigationDeps) {
  const flowRun = useRunFlowRunPort();
  const flowTalents = useRunFlowTalentPort();
  const contentRun = useContentNavigationRunPort();
  const contentTalents = useContentNavigationTalentPort();
  const wildwoodRun = useWildwoodRunPort();
  const corruptionRun = useCorruptionRunPort();
  const destinationRun = useDestinationRunPort();
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
    run: destinationRun,
    hasActiveBattle,
    navigateTo,
    clearCardHover,
  });

  const wildwood = useWildwoodGauntletFlow({
    run: wildwoodRun,
    navigateTo,
    onStartBossById: battle.onStartBossById,
    setHasActiveBattle,
    clearCardHover,
    rng: randomSources.world,
  });

  const contentNav = useContentSystemNavigation({
    run: contentRun,
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
    onStartNextWildwoodBoss: wildwood.startNextWildwoodBoss,
    destinationRng: randomSources.destinations,
    worldRng: randomSources.world,
  });

  const handleDraftComplete = useCallback(
    (draftedCards: BattleCard[]) => {
      if (flowRun.contentSystemType !== CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
        contentNav.handleDraftComplete(draftedCards);
        return;
      }
      wildwood.handleDraftComplete(draftedCards);
    },
    [flowRun.contentSystemType, contentNav, wildwood],
  );

  const mystery = useMysteryEventNavigation({
    navigateTo,
    eventsRng: randomSources.events,
  });

  const wildwoodNavOps = useMemo(
    () =>
      wildwoodOverride ?? {
        onCommitWildwoodVictory: wildwood.commitWildwoodVictory,
        onWildwoodRewardComplete: wildwood.handleWildwoodRewardComplete,
        onSelectRewardChoice: wildwood.selectRewardChoice,
      },
    [
      wildwoodOverride,
      wildwood.commitWildwoodVictory,
      wildwood.handleWildwoodRewardComplete,
      wildwood.selectRewardChoice,
    ],
  );

  const mysteryNavOps = useMemo(
    () =>
      mysteryOverride ?? {
        beginMysteryEvent: mystery.beginMysteryEvent,
        clearMysteryCardChoices: mystery.clearCardChoices,
      },
    [mysteryOverride, mystery.beginMysteryEvent, mystery.clearCardChoices],
  );

  const dispatch = useMemo(
    () =>
      createRunFlowIntentExecutor({
        navigateTo,
        transition,
        labyrinth,
        shop,
        battle,
        wildwood: wildwoodNavOps,
        mystery: mysteryNavOps,
        onMarkDifficultyCompleted,
      }),
    [navigateTo, transition, labyrinth, shop, battle, wildwoodNavOps, mysteryNavOps, onMarkDifficultyCompleted],
  );

  const flowHandlers = useRunFlowHandlers({
    run: flowRun,
    talents: flowTalents,
    dispatch,
    contentNav,
    getAvailableDestinations: destinations.getAvailableDestinations,
    rewardRng: randomSources.rewards,
    destinationRng: randomSources.destinations,
    worldRng: randomSources.world,
  });

  const corruption = useRunCorruptionFlow({
    getRunDeck: () => corruptionRun.runDeck,
    updateRunDeck: corruptionRun.updateRunDeck,
    eventsRng: randomSources.events,
    advanceToNextDestination: flowHandlers.advanceToNextDestination,
  });

  const teardown = useRunTeardown({
    cancelPending,
    setHasActiveBattle,
    clearCardHover,
    navigateTo,
  });

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
    handleDraftComplete,
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
