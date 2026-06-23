// Run-flow controller for routing, rewards, mysteries, campfires, act transitions, and reset.
/* eslint-disable react-hooks/refs -- flow handler factories receive draft refs */
// Depends on: run-session/ui stores, battle system, game constants, audio registry, and navigation flow helpers.
// Depended on by: useAlchemyRunController for managing the overall flow of a run.
import { useCallback, useRef, useMemo } from "react";
import {
  useRunAdapter,
  useTalentAdapter,
  useRunDomainStore,
  useRunSessionNavigationSlice,
} from "@/features/alchemy/shared/stores/run-session-facade";
import { teardownRun } from "@/features/alchemy/shared/stores/run-transitions";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { useBattlePresentationStore } from "@/features/alchemy/shared/stores/battle-presentation-store";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";
import { flattenGearInventories } from "@/lib/gear";
import { type BattleCard, type CharacterId, type DifficultyId, type DifficultyModifier } from "@/lib/game-data";
import { playUISound } from "@/lib/audio";

import { CONSTANTS, type Destination, type Screen } from "@/features/alchemy/shared/types";
import { getRunAvailableDestinations } from "@/features/alchemy/run-loop/navigation/destination-flow";

import { getPreviousDestination } from "@/features/alchemy/run-loop/navigation/run-navigation-helpers";
import { useMysteryFlow } from "@/features/alchemy/run-loop/navigation/use-mystery-flow";
import { applyCorruptionToDeck } from "@/features/alchemy/run-loop/navigation/run-navigation-corruption";
import { createRunFlowHandlers } from "@/features/alchemy/run-loop/run/run-flow-handlers";
import { createContentSystemNavigation } from "@/features/alchemy/run-setup/run/content-system-navigation";
import type { ScreenTransitionOptions } from "./use-screen-transitions";
import type { DestinationOptionsInput } from "@/features/alchemy/run-loop/navigation/destination-flow";
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
}) {
  const run = useRunAdapter();
  const talents = useTalentAdapter();

  const setHasActiveBattle = useRunDomainStore((s) => s.setHasActiveBattle);
  const clearCardGhosts = useBattlePresentationStore((s) => s.clearCardGhosts);

  const completedDifficulties = useAppStore((s) => s.completedDifficulties);

  const draftedDeckRef = useRef<BattleCard[] | null>(null);
  const rngRef = useRef<() => number>(() => Math.random());
  const nav = useRunSessionNavigationSlice(screen);
  const clearCardHover = useUiStore((s) => s.clearCardHover);
  const runPhase = nav.phase;
  const hasActiveBattle = nav.hasActiveBattle;
  const hasActiveRun = nav.hasActiveRun;
  const rewardState = nav.rewardState;
  const runEndMaterials = nav.runEndMaterials;
  const corruptionResult = nav.corruptionResult;
  const pendingCharacterId = nav.pendingCharacterId;
  const pendingContentSystemType = nav.pendingContentSystemType;

  const getAvailableDestinations = useCallback(
    (options: DestinationOptionsInput = {}): Destination[] => {
      const destinationIndexInAct = options.destinationIndexInAct ?? run.destinationIndexInAct;
      const previousDestination = getPreviousDestination(destinationIndexInAct, run.completedDestinations);
      return getRunAvailableDestinations({
        destinationIndexInAct,
        currentHealth: options.currentHealth ?? run.runPlayerHealth,
        currentGold: options.currentGold ?? run.runGold,
        maxHealth: options.maxHealth ?? run.runMaxHealth,
        previousDestination,
        hasAnyOwnedGear:
          options.hasAnyOwnedGear ?? flattenGearInventories(useGearStore.getState().inventories).length > 0,
      });
    },
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
    ],
  );

  function handleDraftComplete(draftedCards: BattleCard[]) {
    if (run.contentSystemType !== CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
      contentNav.handleDraftComplete(draftedCards);
      return;
    }
    wildwood.handleDraftComplete(draftedCards);
  }

  const mystery = useMysteryFlow();

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
    ],
  );

  function goToScreen(nextScreen: Screen) {
    clearCardHover();
    navigateTo(nextScreen);
  }

  function selectRewardChoice(id: string) {
    flowHandlers.selectRewardChoice(id);
    wildwood.selectRewardChoice(id);
  }

  function handleCorruptCard(cardIndex: number) {
    applyCorruptionToDeck(run.runDeck, cardIndex, rngRef.current, run.setRunDeck);
  }

  function handleCorruptionExit() {
    flowHandlers.advanceToNextDestination();
  }

  function handleMysteryContinue() {
    flowHandlers.advanceToNextDestination();
  }

  function resetRunState() {
    cancelPending();
    clearCardGhosts();
    clearCardHover();
    setHasActiveBattle(false);
    navigateTo(CONSTANTS.SCREENS.MENU, () => {
      teardownRun();
    });
  }

  function continueFromRunEnd() {
    clearCardHover();
    resetRunState();
  }

  return {
    runPhase,
    rewardState,
    get runEndMaterials() {
      return runEndMaterials;
    },
    get mysteryEvent() {
      return mystery.mysteryEvent;
    },
    get mysteryCardChoices() {
      return mystery.mysteryCardChoices;
    },
    get corruptionResult() {
      return corruptionResult;
    },
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
    selectRewardChoice,
    handleWildwoodRecoveryComplete: wildwood.handleWildwoodRecoveryComplete,
    handleWildwoodRemoveCard: wildwood.handleWildwoodRemoveCard,
    handleWildwoodSkipRemoval: wildwood.handleWildwoodSkipRemoval,
    prepareDestinationScreen: flowHandlers.prepareDestinationScreen,
    handleCampfireContinue: flowHandlers.handleCampfireContinue,
    handleCorruptCard,
    handleCorruptionExit,
    handleMysteryChoice: mystery.handleMysteryChoice,
    handleMysteryChooseCard: mystery.handleMysteryChooseCard,
    handleMysteryRemoveCard: mystery.handleMysteryRemoveCard,
    handleMysteryContinue,
    resetRunState,
    continueFromRunEnd,
    handleBattleVictory: flowHandlers.handleBattleVictory,
    handleBattleDefeat: flowHandlers.handleBattleDefeat,
  };
}
