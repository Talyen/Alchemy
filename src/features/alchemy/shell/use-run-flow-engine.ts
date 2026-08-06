// Consolidated Run Flow Engine hook for Alchemy shell navigation and sub-system flow routing.
import { useMemo, useCallback } from "react";
import {
  useRunOrchestrationPort,
  useRunFlowTalentPort,
  useContentNavigationTalentPort,
  useTalentEffects,
  useSetHasActiveBattle,
} from "@/features/alchemy/shared/stores/run-session-react-ports";
import { useCompletedDifficulties } from "@/features/alchemy/shared/stores/profile-store";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { useRunSessionNavigationSlice } from "@/features/alchemy/shared/stores/run-session-model";
import { useGameplayStateStore } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { readActiveRun } from "@/features/alchemy/shared/stores/run-session-read-port";
import { setRunDeck } from "@/features/alchemy/shared/stores/run-session-write-port";
import { CONSTANTS } from "@/features/alchemy/shared/types";
import type { BattleCard } from "@/lib/game-data";
import { createRunFlowHandlers } from "@/features/alchemy/run-loop/run/run-flow-handlers";
import { createCorruptionFlowHandlers } from "@/features/alchemy/run-loop/navigation/run-navigation-corruption";
import { createRunTeardown } from "@/features/alchemy/run-loop/run/create-run-teardown";
import { useRunDestinationWiring } from "./use-run-destination-wiring";
import { useWildwoodGauntletFlow } from "./use-wildwood-gauntlet-flow";
import { useContentSystemNavigation } from "./use-content-system-navigation";
import { useMysteryEventNavigation } from "./use-mystery-event-navigation";
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
  onMarkDifficultyCompleted,
  randomSources,
}: RunNavigationDeps) {
  const orchestration = useRunOrchestrationPort();
  const talentEffects = useTalentEffects();
  const talentXP = useGameplayStateStore((state) => state.runProfile.talentXP);
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
    rng: randomSources.world,
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
    onStartNextWildwoodBoss: wildwood.startNextWildwoodBoss,
    destinationRng: randomSources.destinations,
    worldRng: randomSources.world,
    clearCardHover,
  });

  const handleDraftComplete = useCallback(
    (draftedCards: BattleCard[]) => {
      if (orchestration.contentSystemType !== CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
        contentNav.handleDraftComplete(draftedCards);
        return;
      }
      wildwood.handleDraftComplete(draftedCards);
    },
    [orchestration.contentSystemType, contentNav, wildwood],
  );

  const mystery = useMysteryEventNavigation({
    navigateTo,
    eventsRng: randomSources.events,
  });

  const wildwoodNavOps = useMemo(
    () => ({
      onCommitWildwoodVictory: wildwood.commitWildwoodVictory,
      onWildwoodRewardComplete: wildwood.handleWildwoodRewardComplete,
      onSelectRewardChoice: wildwood.selectRewardChoice,
    }),
    [wildwood.commitWildwoodVictory, wildwood.handleWildwoodRewardComplete, wildwood.selectRewardChoice],
  );

  const mysteryNavOps = useMemo(
    () => ({
      beginMysteryEvent: mystery.beginMysteryEvent,
      clearMysteryCardChoices: mystery.clearCardChoices,
    }),
    [mystery.beginMysteryEvent, mystery.clearCardChoices],
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

  const flowHandlers = useMemo(
    () =>
      createRunFlowHandlers({
        run: orchestration,
        talents: flowTalents,
        dispatch,
        contentNav,
        getAvailableDestinations: destinations.getAvailableDestinations,
        rewardRng: randomSources.rewards,
        destinationRng: randomSources.destinations,
        worldRng: randomSources.world,
      }),
    [
      orchestration,
      flowTalents,
      dispatch,
      contentNav,
      destinations.getAvailableDestinations,
      randomSources.rewards,
      randomSources.destinations,
      randomSources.world,
    ],
  );

  const corruption = useMemo(
    () =>
      createCorruptionFlowHandlers({
        getRunDeck: () => readActiveRun().runDeck,
        updateRunDeck: setRunDeck,
        eventsRng: randomSources.events,
        advanceToNextDestination: flowHandlers.advanceToNextDestination,
      }),
    [randomSources.events, flowHandlers.advanceToNextDestination],
  );

  const teardown = useMemo(
    () =>
      createRunTeardown({
        cancelPending,
        setHasActiveBattle,
        clearCardHover,
        navigateTo,
      }),
    [cancelPending, setHasActiveBattle, clearCardHover, navigateTo],
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
