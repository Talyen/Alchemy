// Run-flow controller for routing, rewards, mysteries, campfires, act transitions, and reset.
/* eslint-disable react-hooks/refs -- flow handler factories receive draft refs */
// Depends on: run-session/ui stores, battle system, game constants, audio registry, and navigation flow helpers.
// Depended on by: useAlchemyRunController for managing the overall flow of a run.
import { useCallback, useRef, useMemo } from "react";
import {
  useRunAdapter,
  useTalentAdapter,
  useSetHasActiveBattle,
  useRunSessionNavigationSlice,
} from "@/features/alchemy/shared/stores/run-session-facade";
import { useProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
// Side-effect: registers presentation cleanup with the shared bridge.
import "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { readHasAnyOwnedGear } from "@/features/alchemy/shared/stores/gear-read-port";
import { type BattleCard, type CharacterId, type DifficultyId, type DifficultyModifier } from "@/lib/game-data";
import { playUISound } from "@/lib/audio";
import { CONSTANTS, type Screen } from "@/features/alchemy/shared/types";
import { bindAvailableDestinationsResolver } from "@/features/alchemy/shared/run-flow";
import { useMysteryFlow } from "@/features/alchemy/run-loop/navigation/use-mystery-flow";
import { createCorruptionFlowHandlers } from "@/features/alchemy/run-loop/navigation/run-navigation-corruption";
import { createRunFlowHandlers } from "@/features/alchemy/run-loop/run/run-flow-handlers";
import { createRunTeardown } from "@/features/alchemy/run-loop/run/create-run-teardown";
import { createContentSystemNavigation } from "@/features/alchemy/run-setup/run/content-system-navigation";
import type { ScreenTransitionOptions } from "./use-screen-transitions";
import { useWildwoodGauntletFlow } from "./use-wildwood-gauntlet-flow";
import type { WildwoodModifierId } from "@/lib/content-systems/wildwood/gauntlet";

export function useRunNavigation({
  screen,
  navigateTo,
  transition,
  cancelPending,
  onStartBattle,
  onStartBossBattle,
  onStartBossById,
  onLabyrinthClearNode,
  onLabyrinthFailNode,
  onInitShop,
  onInitAlchemist,
  onInitTrinketShop,
  onInitEquipmentShop,
  onMarkDifficultyCompleted,
  randomSources,
}: {
  screen: Screen;
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
  transition: (nextScreen: Screen, options?: ScreenTransitionOptions) => void;
  cancelPending: () => void;
  onStartBattle: (
    deck?: BattleCard[],
    gold?: number,
    enemyType?: "normal" | "elite",
    modifiers?: DifficultyModifier[],
  ) => void;
  onStartBossBattle: () => void;
  onStartBossById: (
    bossId: string,
    modifiers?: DifficultyModifier[],
    wildwoodModifierId?: WildwoodModifierId,
  ) => boolean;
  onLabyrinthClearNode: () => void;
  onLabyrinthFailNode: () => void;
  onInitShop: () => void;
  onInitAlchemist: () => void;
  onInitTrinketShop: () => void;
  onInitEquipmentShop: () => void;
  onMarkDifficultyCompleted: (characterId: CharacterId, difficultyId: DifficultyId) => void;
  randomSources: {
    rewards: () => number;
    destinations: () => number;
    events: () => number;
    world: () => number;
  };
}) {
  const run = useRunAdapter();
  const talents = useTalentAdapter();
  const setHasActiveBattle = useSetHasActiveBattle();
  const completedDifficulties = useProfileStore((s) => s.completedDifficulties);
  const draftedDeckRef = useRef<BattleCard[] | null>(null);
  const nav = useRunSessionNavigationSlice(screen);
  const clearCardHover = useUiStore((s) => s.clearCardHover);
  const runPhase = nav.phase;
  const hasActiveBattle = nav.hasActiveBattle;
  const hasActiveRun = nav.hasActiveRun;
  const pendingCharacterId = nav.pendingCharacterId;
  const pendingContentSystemType = nav.pendingContentSystemType;

  const getAvailableDestinations = useMemo(
    () =>
      bindAvailableDestinationsResolver(() => ({
        destinationIndexInAct: run.destinationIndexInAct,
        completedDestinations: run.completedDestinations,
        runPlayerHealth: run.runPlayerHealth,
        runGold: run.runGold,
        runMaxHealth: run.runMaxHealth,
        hasAnyOwnedGear: readHasAnyOwnedGear(),
      })),
    [run.destinationIndexInAct, run.completedDestinations, run.runPlayerHealth, run.runGold, run.runMaxHealth],
  );

  const returnToBattle = useCallback(() => {
    if (hasActiveBattle) navigateTo(CONSTANTS.SCREENS.BATTLE);
  }, [hasActiveBattle, navigateTo]);

  const wildwood = useWildwoodGauntletFlow({
    run,
    navigateTo,
    onStartBossById,
    setHasActiveBattle,
    clearCardHover,
    rng: randomSources.world,
  });

  const contentNav = useMemo(
    () =>
      createContentSystemNavigation({
        run,
        talents,
        draftedDeckRef,
        hasActiveRun,
        hasActiveBattle,
        pendingContentSystemType,
        completedDifficulties,
        navigateTo,
        returnToBattle,
        onStartBattle,
        getAvailableDestinations,
        onResumeWildwood: wildwood.resumeWildwoodRun,
        onStartNextWildwoodBoss: wildwood.startNextWildwoodBoss,
        destinationRng: randomSources.destinations,
        worldRng: randomSources.world,
      }),
    [
      run,
      talents,
      hasActiveRun,
      hasActiveBattle,
      pendingContentSystemType,
      completedDifficulties,
      navigateTo,
      returnToBattle,
      onStartBattle,
      getAvailableDestinations,
      wildwood.resumeWildwoodRun,
      wildwood.startNextWildwoodBoss,
      randomSources.destinations,
      randomSources.world,
    ],
  );

  function handleDraftComplete(draftedCards: BattleCard[]) {
    if (run.contentSystemType !== CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
      contentNav.handleDraftComplete(draftedCards);
      return;
    }
    wildwood.handleDraftComplete(draftedCards);
  }

  const mystery = useMysteryFlow(randomSources.events);
  const beginMysteryEvent = useCallback(() => {
    mystery.beginMysteryEvent(() => navigateTo(CONSTANTS.SCREENS.MYSTERY));
    playUISound("musicBoxMystery");
  }, [mystery, navigateTo]);

  const flowHandlers = useMemo(
    () =>
      createRunFlowHandlers({
        run,
        talents,
        navigateTo,
        transition,
        onLabyrinthFailNode,
        onLabyrinthClearNode,
        onInitShop,
        onInitAlchemist,
        onInitTrinketShop,
        onInitEquipmentShop,
        onStartBattle,
        onStartBossBattle,
        onStartBossById,
        onMarkDifficultyCompleted,
        onCommitWildwoodVictory: wildwood.commitWildwoodVictory,
        contentNav,
        getAvailableDestinations,
        beginMysteryEvent,
        clearMysteryCardChoices: mystery.clearCardChoices,
        onWildwoodRewardComplete: wildwood.handleWildwoodRewardComplete,
        onSelectRewardChoice: wildwood.selectRewardChoice,
        rewardRng: randomSources.rewards,
        destinationRng: randomSources.destinations,
        worldRng: randomSources.world,
      }),
    [
      run,
      talents,
      navigateTo,
      transition,
      onLabyrinthFailNode,
      onLabyrinthClearNode,
      onInitShop,
      onInitAlchemist,
      onInitTrinketShop,
      onInitEquipmentShop,
      onStartBattle,
      onStartBossBattle,
      onStartBossById,
      onMarkDifficultyCompleted,
      wildwood.commitWildwoodVictory,
      contentNav,
      getAvailableDestinations,
      beginMysteryEvent,
      mystery.clearCardChoices,
      wildwood.handleWildwoodRewardComplete,
      wildwood.selectRewardChoice,
      randomSources.rewards,
      randomSources.destinations,
      randomSources.world,
    ],
  );

  const corruption = useMemo(
    () =>
      createCorruptionFlowHandlers({
        getRunDeck: () => run.runDeck,
        setRunDeck: run.setRunDeck,
        eventsRng: randomSources.events,
        advanceToNextDestination: flowHandlers.advanceToNextDestination,
      }),
    [run.runDeck, run.setRunDeck, randomSources.events, flowHandlers.advanceToNextDestination],
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

  function goToScreen(nextScreen: Screen) {
    clearCardHover();
    navigateTo(nextScreen);
  }

  function handleMysteryContinue() {
    flowHandlers.advanceToNextDestination();
  }

  return {
    runPhase,
    get activeRunData(): boolean {
      return hasActiveRun;
    },
    get pendingCharacterId() {
      return pendingCharacterId;
    },
    getAvailableDestinations,
    advanceToNextDestination: flowHandlers.advanceToNextDestination,
    beginCampaign: contentNav.beginCampaign,
    beginLabyrinth: contentNav.beginLabyrinth,
    beginWildwood: contentNav.beginWildwood,
    beginMysteryEvent,
    endLabyrinthRun: flowHandlers.endLabyrinthRun,
    handleAbandonRun: flowHandlers.handleAbandonRun,
    handleCharacterSelect: contentNav.handleCharacterSelect,
    handleDraftComplete,
    handleDraftPick: wildwood.handleDraftPick,
    handleDifficultySelect: contentNav.handleDifficultySelect,
    handleBackFromDifficultySelect: contentNav.handleBackFromDifficultySelect,
    returnToBattle,
    goToScreen,
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
