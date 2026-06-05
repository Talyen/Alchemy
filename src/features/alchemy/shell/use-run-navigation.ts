// Run-flow controller for routing, rewards, mysteries, campfires, act transitions, and reset.
/* eslint-disable react-hooks/refs -- mystery/destination wiring updates ref callbacks after hook init */
// Depends on: run-session/ui stores, battle system, game constants, audio registry, and navigation flow helpers.
// Depended on by: useAlchemyRunController for managing the overall flow of a run.
import { useEffect, useCallback, useRef, useMemo } from "react";
import { TimerGroup } from "@/lib/animation/game-timer";
import { useShallow } from "zustand/react/shallow";
import { useRunAdapter, useTalentAdapter } from "@/features/alchemy/stores/run-store";
import { teardownRun } from "@/features/alchemy/stores/run-transitions";
import { useAppStore } from "@/features/alchemy/stores/app-store";
import { useRunDomainStore } from "@/features/alchemy/stores/run-store";
import { useBattlePresentationStore } from "@/features/alchemy/stores/battle-presentation-store";
import { type BattleCard, type CharacterId, type DifficultyId, type DifficultyModifier } from "@/lib/game-data";
import { playUISound } from "@/lib/audio";
import { CONSTANTS, type Destination, type Screen } from "@/features/alchemy/types";
import { getRunAvailableDestinations } from "@/features/alchemy/navigation/destination-flow";
import { getPreviousDestination } from "@/features/alchemy/navigation/run-navigation-helpers";
import { useMysteryFlow } from "@/features/alchemy/navigation/use-mystery-flow";
import { useUiStore } from "@/features/alchemy/stores/ui-store";
import { useRunNavigationSession } from "@/features/alchemy/navigation/run-navigation-session";
import { applyCorruptionToDeck } from "@/features/alchemy/navigation/run-navigation-corruption";
import { useActiveRunSnapshot } from "@/features/alchemy/run-loop/run/use-active-run-snapshot";
import { createRunVictoryHandlers } from "@/features/alchemy/run-loop/run/run-victory-handlers";
import { createContentSystemNavigation } from "@/features/alchemy/run-setup/run/content-system-navigation";
import { createRunDestinationHandlers } from "@/features/alchemy/run-loop/run/run-destination-handlers";
import type { DestinationOptionsInput } from "@/lib/active-run-session";

export function useRunNavigation({
  screen,
  setScreen,
  navigateTo,
  onStartBattle,
  onStartBossBattle,
  onStartBossById,
  onLabyrinthClearNode,
  onLabyrinthFailNode,
  onInitShop,
  onInitAlchemist,
  onMarkDifficultyCompleted,
}: {
  screen: Screen;
  setScreen: React.Dispatch<React.SetStateAction<Screen>>;
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
  onStartBattle: (
    deck?: BattleCard[],
    gold?: number,
    enemyType?: "normal" | "elite",
    modifiers?: DifficultyModifier[],
  ) => void;
  onStartBossBattle: () => void;
  onStartBossById: (bossId: string, modifiers?: DifficultyModifier[]) => boolean;
  onLabyrinthClearNode: () => void;
  onLabyrinthFailNode: () => void;
  onInitShop: () => void;
  onInitAlchemist: () => void;
  onMarkDifficultyCompleted: (characterId: CharacterId, difficultyId: DifficultyId) => void;
}) {
  const run = useRunAdapter();
  const talents = useTalentAdapter();

  const setHasActiveBattle = useRunDomainStore((s) => s.setHasActiveBattle);
  const clearCardGhosts = useBattlePresentationStore((s) => s.clearCardGhosts);

  const { completedDifficulties, setDiscoveredCardIds, setEncounteredEnemyIds, setDiscoveredTrinketIds } = useAppStore(
    useShallow((s) => ({
      completedDifficulties: s.completedDifficulties,
      setDiscoveredCardIds: s.setDiscoveredCardIds,
      setEncounteredEnemyIds: s.setEncounteredEnemyIds,
      setDiscoveredTrinketIds: s.setDiscoveredTrinketIds,
    })),
  );

  const draftedDeckRef = useRef<BattleCard[] | null>(null);
  const {
    phase: runPhase,
    battle: { hasActiveBattle },
    clearCardHover,
    hasActiveRun,
    activeLabyrinthRewardModifiers,
    rewardState,
    runEndMaterials,
    corruptionResult,
    pendingCharacterId,
    pendingContentSystemType,
  } = useRunNavigationSession(screen);

  const rewardTransitionTimer = useRef(new TimerGroup());
  useEffect(() => () => rewardTransitionTimer.current.clearAll(), []);

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
      });
    },
    [run.destinationIndexInAct, run.completedDestinations, run.runPlayerHealth, run.runGold, run.runMaxHealth],
  );

  const victoryHandlers = useMemo(
    () =>
      createRunVictoryHandlers({
        rewardTransitionTimer,
        setScreen,
        navigateTo,
        onLabyrinthFailNode,
        getAvailableDestinations,
        talents,
      }),
    [setScreen, navigateTo, onLabyrinthFailNode, getAvailableDestinations, talents],
  );

  const { awardRunEndMaterials, clearCombatState, handleBattleVictory, handleBattleDefeat } = victoryHandlers;

  const returnToBattle = useCallback(() => {
    if (hasActiveBattle) navigateTo(CONSTANTS.SCREENS.BATTLE);
  }, [hasActiveBattle, navigateTo]);

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
        setDiscoveredCardIds,
        setEncounteredEnemyIds,
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
      setDiscoveredCardIds,
      setEncounteredEnemyIds,
    ],
  );

  const advanceToNextRef = useRef<() => void>(() => {});

  const mystery = useMysteryFlow({
    advanceToNextDestination: () => advanceToNextRef.current(),
  });

  const beginMysteryEvent = useCallback(() => {
    mystery.beginMysteryEvent(() => navigateTo(CONSTANTS.SCREENS.MYSTERY));
    playUISound("musicBoxMystery");
  }, [mystery, navigateTo]);

  const destinationHandlers = useMemo(
    () =>
      createRunDestinationHandlers({
        run,
        talents,
        activeLabyrinthRewardModifiers,
        navigateTo,
        setScreen,
        setHasActiveBattle,
        setDiscoveredCardIds,
        setDiscoveredTrinketIds,
        onInitShop,
        onInitAlchemist,
        onStartBattle,
        onStartBossBattle,
        onStartBossById,
        onLabyrinthClearNode,
        onMarkDifficultyCompleted,
        contentNav,
        awardRunEndMaterials,
        clearCombatState,
        beginMysteryEvent,
        clearMysteryCardChoices: mystery.clearCardChoices,
        getUiStore: () => useUiStore.getState(),
      }),
    [
      run,
      talents,
      activeLabyrinthRewardModifiers,
      navigateTo,
      setScreen,
      setHasActiveBattle,
      setDiscoveredCardIds,
      setDiscoveredTrinketIds,
      onInitShop,
      onInitAlchemist,
      onStartBattle,
      onStartBossBattle,
      onStartBossById,
      onLabyrinthClearNode,
      onMarkDifficultyCompleted,
      contentNav,
      awardRunEndMaterials,
      clearCombatState,
      beginMysteryEvent,
      mystery.clearCardChoices,
    ],
  );

  useEffect(() => {
    advanceToNextRef.current = destinationHandlers.advanceToNextDestination;
  }, [destinationHandlers.advanceToNextDestination]);

  const currentActiveRunData = useActiveRunSnapshot();

  function handleWildwoodBossSelect(bossId: string) {
    if (!onStartBossById(bossId)) return;
    clearCardHover();
    setHasActiveBattle(true);
    navigateTo(CONSTANTS.SCREENS.BATTLE);
  }

  function goToScreen(nextScreen: Screen) {
    clearCardHover();
    navigateTo(nextScreen);
  }

  function handleCorruptCard(cardIndex: number) {
    applyCorruptionToDeck(run.runDeck, cardIndex, run.setRunDeck, setDiscoveredCardIds);
  }

  function handleCorruptionExit() {
    destinationHandlers.advanceToNextDestination();
  }

  function resetRunState() {
    rewardTransitionTimer.current.clearAll();
    clearCardGhosts();
    clearCardHover();
    setHasActiveBattle(false);
    navigateTo(CONSTANTS.SCREENS.MENU, () => {
      teardownRun();
    });
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
    get activeRunData() {
      return hasActiveRun ? currentActiveRunData : null;
    },
    get pendingCharacterId() {
      return pendingCharacterId;
    },
    getAvailableDestinations,
    advanceToNextDestination: destinationHandlers.advanceToNextDestination,
    beginCampaign: contentNav.beginCampaign,
    beginLabyrinth: contentNav.beginLabyrinth,
    beginWildwood: contentNav.beginWildwood,
    beginMysteryEvent,
    endLabyrinthRun: destinationHandlers.endLabyrinthRun,
    handleCharacterSelect: contentNav.handleCharacterSelect,
    handleDraftComplete: contentNav.handleDraftComplete,
    handleDifficultySelect: contentNav.handleDifficultySelect,
    handleBackFromDifficultySelect: contentNav.handleBackFromDifficultySelect,
    handleWildwoodBossSelect,
    returnToBattle,
    goToScreen,
    handleDestinationChoice: destinationHandlers.handleDestinationChoice,
    handleActComplete: destinationHandlers.handleActComplete,
    finishRewards: destinationHandlers.finishRewards,
    selectRewardChoice: destinationHandlers.selectRewardChoice,
    prepareDestinationScreen: destinationHandlers.prepareDestinationScreen,
    handleCampfireContinue: destinationHandlers.handleCampfireContinue,
    handleCorruptCard,
    handleCorruptionExit,
    handleMysteryChoice: mystery.handleMysteryChoice,
    handleMysteryChooseCard: mystery.handleMysteryChooseCard,
    handleMysteryRemoveCard: mystery.handleMysteryRemoveCard,
    handleMysteryContinue: mystery.handleMysteryContinue,
    resetRunState,
    handleBattleVictory,
    handleBattleDefeat,
  };
}
