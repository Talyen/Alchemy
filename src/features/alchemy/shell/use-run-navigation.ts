// Run-flow controller for routing, rewards, mysteries, campfires, act transitions, and reset.
/* eslint-disable react-hooks/refs -- flow handler factories receive timer and draft refs */
// Depends on: run-session/ui stores, battle system, game constants, audio registry, and navigation flow helpers.
// Depended on by: useAlchemyRunController for managing the overall flow of a run.
import { useEffect, useCallback, useRef, useMemo } from "react";
import { TimerGroup } from "@/lib/animation/game-timer";
import {
  useRunAdapter,
  useTalentAdapter,
  useRunDomainStore,
  useRunSessionNavigationSlice,
  setPendingCharacterId,
  setWildwoodDraft,
} from "@/features/alchemy/shared/stores/run-session-facade";
import { teardownRun } from "@/features/alchemy/shared/stores/run-transitions";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { useBattlePresentationStore } from "@/features/alchemy/shared/stores/battle-presentation-store";
import { type BattleCard, type CharacterId, type DifficultyId, type DifficultyModifier } from "@/lib/game-data";
import { playUISound } from "@/lib/audio";
import { logError } from "@/lib/error-logger";
import { CONSTANTS, type Destination, type Screen } from "@/features/alchemy/shared/types";
import { hasRunEndDiscoveries } from "@/lib/discoveries";
import { getRunAvailableDestinations } from "@/features/alchemy/run-loop/navigation/destination-flow";
import { readActiveRunStore, readRunSessionStore } from "@/features/alchemy/shared/stores/run-session-facade";
import { getPreviousDestination } from "@/features/alchemy/run-loop/navigation/run-navigation-helpers";
import { useMysteryFlow } from "@/features/alchemy/run-loop/navigation/use-mystery-flow";
import { applyCorruptionToDeck } from "@/features/alchemy/run-loop/navigation/run-navigation-corruption";
import { createRunFlowHandlers } from "@/features/alchemy/run-loop/run/run-flow-handlers";
import { createContentSystemNavigation } from "@/features/alchemy/run-setup/run/content-system-navigation";
import type { DestinationOptionsInput } from "@/lib/active-run-session";
import { DRAFT_ROUNDS } from "@/lib/game-constants";
import { appendUnique } from "@/lib/utils";
import {
  createWildwoodDraftChoices,
  canOfferWildwoodRemoval,
  drawWildwoodBoss,
  getWildwoodRecoveryHealth,
  pickWildwoodModifier,
  pickWildwoodRewardTrait,
  type WildwoodModifierId,
} from "@/lib/content-systems/wildwood/gauntlet";

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
  onStartBossById: (
    bossId: string,
    modifiers?: DifficultyModifier[],
    wildwoodModifierId?: WildwoodModifierId,
  ) => boolean;
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

  const completedDifficulties = useAppStore((s) => s.completedDifficulties);

  const draftedDeckRef = useRef<BattleCard[] | null>(null);
  const nav = useRunSessionNavigationSlice(screen);
  const clearCardHover = useUiStore((s) => s.clearCardHover);
  const runPhase = nav.phase;
  const hasActiveBattle = nav.hasActiveBattle;
  const hasActiveRun = nav.hasActiveRun;
  const activeLabyrinthRewardModifiers = nav.activeLabyrinthRewardModifiers;
  const rewardState = nav.rewardState;
  const runEndMaterials = nav.runEndMaterials;
  const corruptionResult = nav.corruptionResult;
  const pendingCharacterId = nav.pendingCharacterId;
  const pendingContentSystemType = nav.pendingContentSystemType;

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

  const returnToBattle = useCallback(() => {
    if (hasActiveBattle) navigateTo(CONSTANTS.SCREENS.BATTLE);
  }, [hasActiveBattle, navigateTo]);

  const startNextWildwoodBoss = useCallback(() => {
    const state = readRunSessionStore().wildwoodDraft;
    if (!state) return;
    const draw = drawWildwoodBoss(state.remainingBossIds, state.currentBossId ?? state.previousBossId);
    const modifierId = pickWildwoodModifier();
    const rewardTraitId = pickWildwoodRewardTrait();
    setWildwoodDraft({
      ...state,
      phase: "battle",
      remainingBossIds: draw.remainingBossIds,
      previousBossId: state.currentBossId ?? state.previousBossId,
      currentBossId: draw.bossId,
      currentCombatTraitIds: [modifierId],
      currentRewardTraitIds: [rewardTraitId],
      rewardType: null,
      rewardChoiceIds: [],
      selectedRewardId: null,
    });
    if (!onStartBossById(draw.bossId, undefined, modifierId)) {
      logError("[useRunNavigation] startNextWildwoodBoss: failed to start boss battle", "other");
      navigateTo(CONSTANTS.SCREENS.MENU, teardownRun);
      return;
    }
    clearCardHover();
    setHasActiveBattle(true);
    navigateTo(CONSTANTS.SCREENS.BATTLE);
  }, [clearCardHover, navigateTo, onStartBossById, setHasActiveBattle]);

  const resumeWildwoodRun = useCallback(() => {
    const state = readRunSessionStore().wildwoodDraft;
    if (!state) {
      navigateTo(CONSTANTS.SCREENS.MENU, teardownRun);
      return;
    }
    if (state.phase === "battle" && state.currentBossId && state.currentCombatTraitIds[0]) {
      if (onStartBossById(state.currentBossId, undefined, state.currentCombatTraitIds[0])) {
        navigateTo(CONSTANTS.SCREENS.BATTLE);
      } else {
        logError("[useRunNavigation] resumeWildwoodRun: failed to resume boss battle", "other");
        navigateTo(CONSTANTS.SCREENS.MENU, teardownRun);
      }
      return;
    }
    if (state.phase === "battle") {
      navigateTo(CONSTANTS.SCREENS.MENU, teardownRun);
      return;
    }
    const routeByPhase = {
      draft: CONSTANTS.SCREENS.DRAFT_DECK,
      recovery: CONSTANTS.SCREENS.WILDWOOD_RECOVERY,
      reward: CONSTANTS.SCREENS.REWARDS,
      removal: CONSTANTS.SCREENS.WILDWOOD_REMOVAL,
    } as const;
    navigateTo(routeByPhase[state.phase]);
  }, [navigateTo, onStartBossById]);

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
        onResumeWildwood: resumeWildwoodRun,
        onStartNextWildwoodBoss: startNextWildwoodBoss,
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
      resumeWildwoodRun,
      startNextWildwoodBoss,
    ],
  );

  function handleDraftPick(card: BattleCard) {
    const state = readRunSessionStore().wildwoodDraft;
    if (run.contentSystemType !== CONSTANTS.CONTENT_SYSTEMS.WILDWOOD || state?.phase !== "draft") return;
    const nextDeck = [...run.runDeck, card];
    run.setRunDeck(nextDeck);
    useAppStore.getState().setDiscoveredCardIds((current) => appendUnique(current, card.id));
    setWildwoodDraft({
      ...state,
      draftChoices: nextDeck.length >= DRAFT_ROUNDS ? [] : createWildwoodDraftChoices(run.characterId, nextDeck),
    });
  }

  function handleDraftComplete(draftedCards: BattleCard[]) {
    if (run.contentSystemType !== CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
      contentNav.handleDraftComplete(draftedCards);
      return;
    }
    if (draftedCards.length < DRAFT_ROUNDS) return;
    run.setRunDeck(draftedCards);
    setPendingCharacterId(null);
    startNextWildwoodBoss();
  }

  const handleWildwoodRecoveryComplete = useCallback(() => {
    const wildwood = readRunSessionStore().wildwoodDraft;
    if (wildwood?.phase !== "recovery") return;
    const { runPlayerHealth, runMaxHealth, setRunPlayerHealth } = readActiveRunStore();
    setRunPlayerHealth(getWildwoodRecoveryHealth(runPlayerHealth, runMaxHealth));
    setWildwoodDraft({ ...wildwood, phase: "reward" });
    navigateTo(CONSTANTS.SCREENS.REWARDS);
  }, [navigateTo]);

  const handleWildwoodRewardComplete = useCallback(() => {
    const state = readRunSessionStore().wildwoodDraft;
    if (!state) return;
    if (canOfferWildwoodRemoval(readActiveRunStore().runDeck.length)) {
      setWildwoodDraft({
        ...state,
        phase: "removal",
        rewardType: null,
        rewardChoiceIds: [],
        selectedRewardId: null,
      });
      navigateTo(CONSTANTS.SCREENS.WILDWOOD_REMOVAL);
      return;
    }
    startNextWildwoodBoss();
  }, [navigateTo, startNextWildwoodBoss]);

  function handleWildwoodRemoveCard(index: number) {
    run.setRunDeck((deck) => deck.filter((_, cardIndex) => cardIndex !== index));
    startNextWildwoodBoss();
  }

  function handleWildwoodSkipRemoval() {
    startNextWildwoodBoss();
  }

  const mystery = useMysteryFlow();

  const beginMysteryEvent = useCallback(() => {
    mystery.beginMysteryEvent(() => navigateTo(CONSTANTS.SCREENS.MYSTERY));
    playUISound("musicBoxMystery");
  }, [mystery, navigateTo]);

  const flowHandlers = useMemo(
    () =>
      createRunFlowHandlers({
        rewardTransitionTimer,
        run,
        talents,
        activeLabyrinthRewardModifiers,
        navigateTo,
        setScreen,
        setHasActiveBattle,
        onLabyrinthFailNode,
        onLabyrinthClearNode,
        onInitShop,
        onInitAlchemist,
        onStartBattle,
        onStartBossBattle,
        onStartBossById,
        onMarkDifficultyCompleted,
        contentNav,
        getAvailableDestinations,
        beginMysteryEvent,
        clearMysteryCardChoices: mystery.clearCardChoices,
        onWildwoodRewardComplete: handleWildwoodRewardComplete,
      }),
    [
      run,
      talents,
      activeLabyrinthRewardModifiers,
      navigateTo,
      setScreen,
      setHasActiveBattle,
      onLabyrinthFailNode,
      onLabyrinthClearNode,
      onInitShop,
      onInitAlchemist,
      onStartBattle,
      onStartBossBattle,
      onStartBossById,
      onMarkDifficultyCompleted,
      contentNav,
      getAvailableDestinations,
      beginMysteryEvent,
      mystery.clearCardChoices,
      handleWildwoodRewardComplete,
    ],
  );

  function goToScreen(nextScreen: Screen) {
    clearCardHover();
    navigateTo(nextScreen);
  }

  function selectRewardChoice(id: string) {
    flowHandlers.selectRewardChoice(id);
    const state = readRunSessionStore().wildwoodDraft;
    if (run.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD && state) {
      setWildwoodDraft({ ...state, selectedRewardId: id });
    }
  }

  function handleCorruptCard(cardIndex: number) {
    applyCorruptionToDeck(run.runDeck, cardIndex, run.setRunDeck);
  }

  function handleCorruptionExit() {
    flowHandlers.advanceToNextDestination();
  }

  function handleMysteryContinue() {
    flowHandlers.advanceToNextDestination();
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

  function continueFromRunEnd() {
    clearCardHover();
    const session = readRunSessionStore();
    if (hasRunEndDiscoveries(session.runEndDiscoveredCardIds, session.runEndDiscoveredBoonIds)) {
      navigateTo(CONSTANTS.SCREENS.RUN_DISCOVERIES);
      return;
    }
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
    handleCharacterSelect: contentNav.handleCharacterSelect,
    handleDraftComplete,
    handleDraftPick,
    handleDifficultySelect: contentNav.handleDifficultySelect,
    handleBackFromDifficultySelect: contentNav.handleBackFromDifficultySelect,
    returnToBattle,
    goToScreen,
    handleDestinationChoice: flowHandlers.handleDestinationChoice,
    handleActComplete: flowHandlers.handleActComplete,
    finishRewards: flowHandlers.finishRewards,
    selectRewardChoice,
    handleWildwoodRecoveryComplete,
    handleWildwoodRemoveCard,
    handleWildwoodSkipRemoval,
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
