// Run-flow controller for routing, rewards, mysteries, campfires, act transitions, and reset.
/* eslint-disable react-hooks/refs -- mystery/destination wiring updates ref callbacks after hook init */
// Depends on: run-session/ui stores, battle system, game constants, audio registry, and navigation flow helpers.
// Depended on by: useAlchemyRunController for managing the overall flow of a run.
import { useEffect, useCallback, useRef, useMemo } from "react";
import { TimerGroup } from "@/lib/animation/game-timer";
import { useShallow } from "zustand/react/shallow";
import { useRunAdapter, useTalentAdapter } from "./stores/run-store";
import { resetActiveRunStores } from "./stores/reset";
import { useAppStore } from "./stores/app-store";
import { useBattleStore } from "./stores/battle-store";
import { useBattlePresentationStore } from "./stores/battle-presentation-store";
import { type BattleCard, type CharacterId, type DifficultyId, type DifficultyModifier } from "@/lib/game-data";
import { playUISound } from "@/lib/audio";
import { CONSTANTS, type Destination, type Screen } from "./types";
import { getRunAvailableDestinations } from "./navigation/destination-flow";
import { getPreviousDestination } from "./navigation/run-navigation-helpers";
import { useMysteryFlow } from "./navigation/use-mystery-flow";
import { useUiStore } from "./stores/ui-store";
import { useRunSessionStore } from "./stores/run-session-store";
import { useRunNavigationSession } from "./navigation/run-navigation-session";
import { applyCorruptionToDeck } from "./navigation/run-navigation-corruption";
import { useActiveRunSnapshot } from "./run/use-active-run-snapshot";
import { createRunVictoryHandlers } from "./run/run-victory-handlers";
import { createContentSystemNavigation } from "./run/content-system-navigation";
import { createRunDestinationHandlers } from "./run/run-destination-handlers";
import type { DestinationOptionsInput } from "./run/types";

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

  const { battleState, hasActiveBattle, setHasActiveBattle } = useBattleStore(
    useShallow((s) => ({
      battleState: s.battleState,
      hasActiveBattle: s.hasActiveBattle,
      setHasActiveBattle: s.setHasActiveBattle,
    })),
  );
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
    clearCardHover,
    hasActiveRun,
    labyrinthMap,
    labyrinthPendingNode,
    activeLabyrinthModifiers,
    activeLabyrinthRewardModifiers,
    rewardState,
    runEndMaterials,
    corruptionResult,
    pendingCharacterId,
    pendingContentSystemType,
  } = useRunNavigationSession();

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

  const mystery = useMysteryFlow({ advanceToNextDestination: () => advanceToNextRef.current() });

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
        getRunSessionStore: () => useRunSessionStore.getState(),
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

  const currentActiveRunData = useActiveRunSnapshot({
    characterId: run.characterId,
    runDeck: run.runDeck,
    runGold: run.runGold,
    runPlayerHealth: run.runPlayerHealth,
    runMaxHealth: run.runMaxHealth,
    roomsEncountered: run.roomsEncountered,
    currentAct: run.currentAct,
    destinationIndexInAct: run.destinationIndexInAct,
    completedDestinations: run.completedDestinations,
    runTrinkets: run.runTrinkets,
    encounteredRunEnemyIds: run.encounteredRunEnemyIds,
    selectedDifficulty: run.selectedDifficulty,
    contentSystemType: run.contentSystemType,
    labyrinthMap,
    hasActiveBattle,
    battleState,
    labyrinthPendingNode,
    activeLabyrinthModifiers,
    activeLabyrinthRewardModifiers,
    runTalentXP: talents.runTalentXP,
    currentScreen: screen,
    destinationChoices: rewardState.destinations,
  });

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
    applyCorruptionToDeck(run.runDeck, cardIndex, run.setRunDeck, setDiscoveredCardIds, useRunSessionStore.getState());
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
      resetActiveRunStores();
    });
  }

  return {
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
