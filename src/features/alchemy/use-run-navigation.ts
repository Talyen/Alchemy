// Run-flow controller for routing, rewards, mysteries, campfires, act transitions, and reset.
// Depends on: useScreenStore, battle system, game constants, audio registry, and navigation flow helpers.
// Depended on by: useAlchemyRunController for managing the overall flow of a run.
import { useEffect, useMemo, useRef, useCallback } from "react";
import { TimerGroup } from "@/lib/animation/game-timer";
import { useShallow } from "zustand/react/shallow";
import { useRunStore, useRunAdapter, useTalentAdapter } from "./stores/run-store";
import { resetActiveRunStores } from "./stores/reset";
import { useAppStore } from "./stores/app-store";
import { useHomesteadStore } from "./stores/homestead-store";
import { useBattleStore } from "./stores/battle-store";
import { logError } from "@/lib/error-logger";

import {
  getDifficultyModifiers,
  type BattleCard,
  type CharacterId,
  type DifficultyId,
  type DifficultyModifier,
} from "@/lib/game-data";
import { playVictory, playDefeat, playGoldGain, stopAllSfx, playUISound } from "@/lib/audio";
import { appendUnique, appendUniqueMany } from "@/lib/utils";
import { CONSTANTS, type Destination, type Screen } from "./types";
import { getBossEnemy } from "./config";
import { applyMaterialFindBonus, getEndOfRunMaterials } from "@/lib/homestead/loot";
import { addInventory } from "@/lib/homestead/inventory";
import { type MaterialInventory } from "@/lib/homestead/types";
import {
  ACTS_PER_RUN,
  CAMPFIRE_HEAL_FRACTION,
  DEFAULT_BATTLE_ENEMY_TYPE,
  DEFAULT_CAMPAIGN_DIFFICULTY_ID,
  VICTORY_TRANSITION_DELAY,
} from "@/lib/game-constants";
import { getRunAvailableDestinations, sampleDestinationChoices } from "./navigation/destination-flow";
import {
  getActiveRewardModifiersForContentSystem,
  getCompanionCardChoices,
  getRandomPotionCard,
  shouldGrantAlchemistReward,
  shouldGrantCompanionReward,
  finalizeRewardState,
  type RewardState,
} from "./navigation/reward-flow";
import {
  computeVictoryRewards,
  createDestinationRewardState,
  withSelectedBossForDestinations,
} from "./navigation/victory-flow";
import { useMysteryFlow } from "./navigation/use-mystery-flow";
import { routeDestinationChoice } from "./navigation/routing-flow";
import { createActiveRunData } from "./run/active-run-data";
import { createRunStartSnapshot, type RunStartSnapshot } from "./run/run-start";
import { corruptDeckCard } from "./corruption";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { useScreenStore } from "./stores/screen-store";

type DestinationOptionsInput = {
  currentHealth?: number;
  currentGold?: number;
  destinationIndexInAct?: number;
  maxHealth?: number;
};

type RewardSelectionInput = {
  choice: BattleCard | { id: string };
  type: RewardState["rewardType"];
  setRunDeck: (fn: (prev: BattleCard[]) => BattleCard[]) => void;
  setRunTrinkets: (fn: (prev: string[]) => string[]) => void;
  setDiscoveredCardIds: (fn: (prev: string[]) => string[]) => void;
  setDiscoveredTrinketIds: (fn: (prev: string[]) => string[]) => void;
};

type AlchemistPotionInput = {
  setRunDeck: (fn: (prev: BattleCard[]) => BattleCard[]) => void;
  setDiscoveredCardIds: (fn: (prev: string[]) => string[]) => void;
};

// Adds the chosen victory reward (card or trinket) to the player's run deck/inventory and tracks discovery.
function applyRewardSelection({
  choice,
  type,
  setRunDeck,
  setRunTrinkets,
  setDiscoveredCardIds,
  setDiscoveredTrinketIds,
}: RewardSelectionInput) {
  const selectedId = choice.id;
  if (type === "card") {
    setRunDeck((prev) => [...prev, choice as BattleCard]);
    setDiscoveredCardIds((cur) => appendUnique(cur, selectedId));
  } else {
    setRunTrinkets((prev) => [...prev, selectedId]);
    setDiscoveredTrinketIds((cur) => appendUnique(cur, selectedId));
  }
}

// Generates a random potion card and appends it to the deck, marking it discovered.
function applyAlchemistPotion({ setRunDeck, setDiscoveredCardIds }: AlchemistPotionInput) {
  const potion = getRandomPotionCard();
  setRunDeck((prev) => [...prev, potion]);
  setDiscoveredCardIds((cur) => appendUnique(cur, potion.id));
}

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

  const logicalBattleState = useBattleStore((s) => s.logicalBattleState);
  const hasActiveBattle = useBattleStore((s) => s.hasActiveBattle);
  const setHasActiveBattle = useBattleStore((s) => s.setHasActiveBattle);
  const clearCardGhosts = useBattleStore((s) => s.clearCardGhosts);

  const { completedDifficulties, setDiscoveredCardIds, setEncounteredEnemyIds, setDiscoveredTrinketIds } = useAppStore(
    useShallow((s) => ({
      completedDifficulties: s.completedDifficulties,
      setDiscoveredCardIds: s.setDiscoveredCardIds,
      setEncounteredEnemyIds: s.setEncounteredEnemyIds,
      setDiscoveredTrinketIds: s.setDiscoveredTrinketIds,
    })),
  );

  const draftedDeckRef = useRef<BattleCard[] | null>(null);
  const setHoveredCardId = useScreenStore((s) => s.setHoveredCardId);
  const hasActiveRun = useScreenStore((s) => s.hasActiveRun);
  const labyrinthMap = useScreenStore((s) => s.labyrinthMap);
  const labyrinthPendingNode = useScreenStore((s) => s.activeLabyrinthPendingNode);
  const activeLabyrinthModifiers = useScreenStore((s) => s.activeLabyrinthModifiers);
  const activeLabyrinthRewardModifiers = useScreenStore((s) => s.activeLabyrinthRewardModifiers);

  const rewardState = useScreenStore((s) => s.rewardState);
  const companionRewardCards = useScreenStore((s) => s.companionRewardCards);
  const runEndMaterials = useScreenStore((s) => s.runEndMaterials);
  const corruptionResult = useScreenStore((s) => s.corruptionResult);
  const pendingCharacterId = useScreenStore((s) => s.pendingCharacterId);
  const pendingContentSystemType = useScreenStore((s) => s.pendingContentSystemType);

  function getStore() {
    return useScreenStore.getState();
  }

  const mystery = useMysteryFlow({
    advanceToNextDestination,
  });
  const rewardTransitionTimer = useRef(new TimerGroup());

  useEffect(() => () => rewardTransitionTimer.current.clearAll(), []);

  const currentActiveRunData = useMemo(
    () =>
      createActiveRunData({
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
        battleState: logicalBattleState,
        labyrinthPendingNode,
        activeLabyrinthModifiers,
        activeLabyrinthRewardModifiers,
        runTalentXP: talents.runTalentXP,
        currentScreen: screen,
        destinationChoices: rewardState.destinations,
      }),
    [
      run.characterId,
      run.runDeck,
      run.runGold,
      run.runPlayerHealth,
      run.runMaxHealth,
      run.roomsEncountered,
      run.currentAct,
      run.destinationIndexInAct,
      run.completedDestinations,
      run.runTrinkets,
      run.encounteredRunEnemyIds,
      run.selectedDifficulty,
      run.contentSystemType,
      labyrinthMap,
      hasActiveBattle,
      logicalBattleState,
      labyrinthPendingNode,
      activeLabyrinthModifiers,
      activeLabyrinthRewardModifiers,
      talents.runTalentXP,
      screen,
      rewardState.destinations,
    ],
  );

  const getAvailableDestinations = useCallback(
    (options: DestinationOptionsInput = {}): Destination[] => {
      const destinationIndexInAct = options.destinationIndexInAct ?? run.destinationIndexInAct;
      const previousDestination =
        destinationIndexInAct === 0 ? undefined : run.completedDestinations[run.completedDestinations.length - 1];
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

  const awardRunEndMaterials = useCallback(
    (displayMaterials: MaterialInventory | null = null) => {
      const homesteadEffects = useHomesteadStore.getState().effects;
      const baseMats = getEndOfRunMaterials(run.roomsEncountered, run.currentAct);
      const baseHerbs = baseMats.herbs + (homesteadEffects.herbFindBonus > 0 ? run.roomsEncountered : 0);
      const food = baseMats.food + (homesteadEffects.flatArrowDamage > 0 ? run.roomsEncountered : 0);
      const combinedBase = {
        wood: baseMats.wood,
        iron: baseMats.iron,
        herbs: baseHerbs,
        food,
        crystal: baseMats.crystal,
      };
      const mats = applyMaterialFindBonus(combinedBase, homesteadEffects);
      useHomesteadStore.getState().addMaterials(mats);
      getStore().setRunEndMaterials(displayMaterials ? addInventory(displayMaterials, mats) : mats);
      return mats;
    },
    [run.roomsEncountered, run.currentAct],
  );

  // ============ Victory / Defeat Effects ============

  function clearCombatState() {
    useBattleStore.getState().setHasActiveBattle(false);
    getStore().setHoveredCardId(null);
  }

  const handleBattleDefeat = useCallback(() => {
    rewardTransitionTimer.current.clearAll();
    const runState = useRunStore.getState();
    if (runState.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
      stopAllSfx();
      clearCombatState();
      onLabyrinthFailNode();
      navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP);
      return;
    }
    awardRunEndMaterials();
    talents.finalizeRunXP();
    stopAllSfx();
    playDefeat();
    clearCombatState();
    setScreen(CONSTANTS.SCREENS.GAME_OVER);
  }, [navigateTo, setScreen, onLabyrinthFailNode, awardRunEndMaterials, talents]);

  // Helper to update player stats (gold, health, max health) after battle victory.
  function applyVictoryStats(result: ReturnType<typeof computeVictoryRewards>) {
    const runState = useRunStore.getState();
    runState.addRunGold(result.goldEarned);
    runState.setRunPlayerHealth(result.playerHealth);
    if (result.maxHealthDelta > 0) {
      runState.setRunMaxHealth((p: number) => p + result.maxHealthDelta);
    }
  }

  // Helper to update screen store reward structures and cleanup active combat state.
  // Triggers companion reward options if Labyrinth reward conditions are met.
  const updateVictoryRewardScreenState = useCallback((result: ReturnType<typeof computeVictoryRewards>) => {
    const screenStore = getStore();
    screenStore.setRewardState(result.rewardState);

    if (shouldGrantCompanionReward(result.labyrinthRewardModifiers)) {
      screenStore.setCompanionRewardCards(getCompanionCardChoices());
    } else {
      screenStore.setCompanionRewardCards(null);
    }

    clearCombatState();
  }, []);

  function computeVictoryResult() {
    const runState = useRunStore.getState();
    const lobby = useHomesteadStore.getState();
    return computeVictoryRewards({
      characterId: runState.characterId,
      selectedDifficulty: runState.selectedDifficulty,
      unlockedTalents: runState.unlockedTalents,
      runDeck: runState.runDeck,
      runTrinkets: runState.runTrinkets,
      contentSystemType: runState.contentSystemType,
      activeLabyrinthRewardModifiers: getStore().activeLabyrinthRewardModifiers,
      battleState: useBattleStore.getState().logicalBattleState,
      runGold: runState.runGold,
      runPlayerHealth: runState.runPlayerHealth,
      runMaxHealth: runState.runMaxHealth,
      destinationIndexInAct: runState.destinationIndexInAct,
      completedDestinations: runState.completedDestinations,
      homesteadEffects: lobby.effects,
      getAvailableDestinations,
      bossEnemyId: getBossEnemy().id,
    });
  }

  function commitVictoryResult(result: ReturnType<typeof computeVictoryRewards>) {
    const battleState = useBattleStore.getState().logicalBattleState;

    if (battleState.pendingMaterials.crystal > 0) {
      useHomesteadStore.getState().addMaterials(battleState.pendingMaterials);
    }

    applyVictoryStats(result);

    if (result.newGold > battleState.gold) {
      playGoldGain();
    }

    updateVictoryRewardScreenState(result);
  }

  const handleBattleVictory = useCallback(() => {
    rewardTransitionTimer.current.clearAll();
    commitVictoryResult(computeVictoryResult());
    stopAllSfx();
    playVictory();
    rewardTransitionTimer.current.setTimeout(() => {
      if (getStore().hasActiveRun) {
        setScreen(CONSTANTS.SCREENS.REWARDS);
      }
    }, VICTORY_TRANSITION_DELAY);
  }, [setScreen, getAvailableDestinations, updateVictoryRewardScreenState]);

  // ============ Content System Flow ============

  function beginContentSystem(systemId: ContentSystemId) {
    if (hasActiveBattle && run.contentSystemType === systemId) {
      returnToBattle();
      return;
    }
    if (hasActiveRun && run.contentSystemType === systemId) {
      if (systemId === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
        navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP);
      } else if (systemId === CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN) {
        const prevDest =
          run.destinationIndexInAct === 0 ? undefined : run.completedDestinations[run.completedDestinations.length - 1];
        navigateTo(CONSTANTS.SCREENS.DESTINATION, () => {
          getStore().setRewardState((prev) => {
            const destinations =
              prev.destinations.length > 0
                ? prev.destinations
                : sampleDestinationChoices(getAvailableDestinations(), prevDest);
            return withSelectedBossForDestinations(destinations, { ...prev, destinations }, getBossEnemy().id);
          });
        });
      } else if (systemId === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
        navigateTo(CONSTANTS.SCREENS.WILDWOOD_SELECT);
      }
      return;
    }
    getStore().setPendingContentSystemType(systemId);
    navigateTo(CONSTANTS.SCREENS.CHARACTER_SELECT);
  }

  function beginCampaign() {
    beginContentSystem(CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN);
  }

  function beginLabyrinth() {
    beginContentSystem(CONSTANTS.CONTENT_SYSTEMS.LABYRINTH);
  }

  function beginWildwood() {
    beginContentSystem(CONSTANTS.CONTENT_SYSTEMS.WILDWOOD);
  }

  function handleCharacterSelect(selectedId: CharacterId) {
    const systemType = pendingContentSystemType;

    if (selectedId === "wildcard") {
      getStore().setPendingCharacterId(selectedId);
      draftedDeckRef.current = null;
      navigateTo(CONSTANTS.SCREENS.DRAFT_DECK);
      return;
    }

    if (systemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
      initializeLabyrinthRun(selectedId);
      return;
    }
    if (systemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
      initializeWildwoodRun(selectedId);
      return;
    }
    if (systemType !== CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN) {
      logError(`[useRunNavigation] handleCharacterSelect: unhandled content system ${systemType}`, "other");
      navigateTo(CONSTANTS.SCREENS.MENU);
      return;
    }

    const completed = completedDifficulties[selectedId] ?? [];
    const hasCompletedNovice = completed.includes(DEFAULT_CAMPAIGN_DIFFICULTY_ID);
    if (!hasCompletedNovice) {
      const { freshDeck, totalStartGold } = initializeRunForDifficulty(selectedId, DEFAULT_CAMPAIGN_DIFFICULTY_ID);
      const modifiers = getDifficultyModifiers(selectedId, DEFAULT_CAMPAIGN_DIFFICULTY_ID);
      onStartBattle(freshDeck, totalStartGold, DEFAULT_BATTLE_ENEMY_TYPE, modifiers);
      navigateTo(CONSTANTS.SCREENS.BATTLE);
      return;
    }

    getStore().setPendingCharacterId(selectedId);
    navigateTo(CONSTANTS.SCREENS.DIFFICULTY_SELECT);
  }

  function handleDraftComplete(draftedCards: BattleCard[]) {
    draftedDeckRef.current = draftedCards;
    const systemType = pendingContentSystemType;

    if (systemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
      initializeLabyrinthRun("wildcard");
      return;
    }
    if (systemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
      initializeWildwoodRun("wildcard");
      return;
    }

    const completed = completedDifficulties["wildcard"] ?? [];
    const hasCompletedNovice = completed.includes(DEFAULT_CAMPAIGN_DIFFICULTY_ID);
    if (!hasCompletedNovice) {
      const { freshDeck, totalStartGold } = initializeRunForDifficulty("wildcard", DEFAULT_CAMPAIGN_DIFFICULTY_ID);
      const modifiers = getDifficultyModifiers("wildcard", DEFAULT_CAMPAIGN_DIFFICULTY_ID);
      onStartBattle(freshDeck, totalStartGold, DEFAULT_BATTLE_ENEMY_TYPE, modifiers);
      navigateTo(CONSTANTS.SCREENS.BATTLE);
      return;
    }

    navigateTo(CONSTANTS.SCREENS.DIFFICULTY_SELECT);
  }

  function initializeLabyrinthRun(characterId: CharacterId) {
    startRun(characterId, CONSTANTS.CONTENT_SYSTEMS.LABYRINTH, { discoverStarterDeck: true, playStartGoldSound: true });
    navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP);
  }

  function initializeWildwoodRun(characterId: CharacterId) {
    startRun(characterId, CONSTANTS.CONTENT_SYSTEMS.WILDWOOD);
    navigateTo(CONSTANTS.SCREENS.WILDWOOD_SELECT);
  }

  function createInitialDestinations(options?: DestinationOptionsInput, prevDest?: Destination) {
    return createDestinationRewardState(
      sampleDestinationChoices(getAvailableDestinations(options), prevDest),
      getBossEnemy().id,
    );
  }

  function initializeRunForDifficulty(characterId: CharacterId, difficultyId: DifficultyId) {
    const snapshot = startRun(characterId, CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN, {
      difficultyId,
      discoverStarterDeck: true,
      playStartGoldSound: true,
      resetEncounteredEnemies: true,
    });
    getStore().setRewardState(
      createInitialDestinations({
        currentHealth: snapshot.runMaxHealth,
        currentGold: snapshot.runGold,
        destinationIndexInAct: 0,
        maxHealth: snapshot.runMaxHealth,
      }),
    );
    return { freshDeck: snapshot.freshDeck, totalStartGold: snapshot.runGold };
  }

  function startRun(
    characterId: CharacterId,
    contentSystemType: ContentSystemId,
    options: {
      difficultyId?: DifficultyId | null;
      discoverStarterDeck?: boolean;
      playStartGoldSound?: boolean;
      resetEncounteredEnemies?: boolean;
    } = {},
  ) {
    const snapshot = createStartSnapshot(characterId, contentSystemType, options.difficultyId);
    applyRunStartSnapshot(snapshot);
    if (options.playStartGoldSound && snapshot.runGold > 0) {
      playGoldGain();
    }
    if (options.discoverStarterDeck || characterId === "wildcard") {
      setDiscoveredCardIds((current) =>
        appendUniqueMany(
          current,
          snapshot.freshDeck.map((c) => c.id),
        ),
      );
    }
    if (options.resetEncounteredEnemies) {
      setEncounteredEnemyIds([]);
    }
    setHoveredCardId(null);
    return snapshot;
  }

  function createStartSnapshot(
    characterId: CharacterId,
    contentSystemType: ContentSystemId,
    difficultyId?: DifficultyId | null,
  ) {
    const homesteadEffects = useHomesteadStore.getState().effects;
    const baseInput = {
      characterId,
      contentSystemType,
      difficultyId,
      talentStartGold: talents.talentEffects.startGold,
      homesteadStartGold: homesteadEffects.startGold,
      homesteadStartMaxHealthBonus: homesteadEffects.startMaxHealthBonus,
    };
    return createRunStartSnapshot(
      characterId === "wildcard" && draftedDeckRef.current
        ? { ...baseInput, draftedDeck: draftedDeckRef.current }
        : baseInput,
    );
  }

  function applyRunStartSnapshot(snapshot: RunStartSnapshot) {
    run.hydrateFromSnapshot(snapshot);
    getStore().setHasActiveRun(snapshot.hasActiveRun);
  }

  function handleDifficultySelect(difficultyId: DifficultyId) {
    if (!pendingCharacterId) {
      logError("[useRunNavigation] handleDifficultySelect: no pending character", "other");
      navigateTo(CONSTANTS.SCREENS.MENU);
      return;
    }
    const selectedId = pendingCharacterId;
    const { freshDeck, totalStartGold } = initializeRunForDifficulty(selectedId, difficultyId);
    const modifiers = getDifficultyModifiers(selectedId, difficultyId);
    onStartBattle(freshDeck, totalStartGold, DEFAULT_BATTLE_ENEMY_TYPE, modifiers);
    navigateTo(CONSTANTS.SCREENS.BATTLE, () => getStore().setPendingCharacterId(null));
  }

  function handleBackFromDifficultySelect() {
    navigateTo(CONSTANTS.SCREENS.CHARACTER_SELECT);
  }

  function returnToBattle() {
    if (hasActiveBattle) navigateTo(CONSTANTS.SCREENS.BATTLE);
  }

  function handleWildwoodBossSelect(bossId: string) {
    if (!onStartBossById(bossId)) return;
    setHoveredCardId(null);
    setHasActiveBattle(true);
    navigateTo(CONSTANTS.SCREENS.BATTLE);
  }

  function goToScreen(nextScreen: Screen) {
    setHoveredCardId(null);
    navigateTo(nextScreen);
  }

  // ============ Rewards & Destinations ============

  type FinalizeRewardResultType = ReturnType<typeof finalizeRewardState>;

  function executeRewardRouteTransition(
    route: FinalizeRewardResultType["route"],
    materials: MaterialInventory,
    nextRewardState: RewardState,
    clearCompanion: boolean,
  ) {
    const store = getStore();
    const setReward = () => store.setRewardState(nextRewardState);

    if (route === CONSTANTS.REWARD_ROUTES.COMPANION_REWARD) {
      if (clearCompanion) {
        store.setCompanionRewardCards(null);
      }
      navigateTo(CONSTANTS.SCREENS.REWARDS, setReward);
      return;
    }

    if (route === CONSTANTS.REWARD_ROUTES.LABYRINTH_VICTORY || route === CONSTANTS.REWARD_ROUTES.WILDWOOD_VICTORY) {
      completeRunVictory(materials, setReward);
      return;
    }

    if (route === CONSTANTS.REWARD_ROUTES.LABYRINTH_MAP) {
      onLabyrinthClearNode();
      navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP, setReward);
      return;
    }

    if (route === CONSTANTS.REWARD_ROUTES.ACT_COMPLETE) {
      handleActComplete(materials);
      return;
    }

    navigateTo(CONSTANTS.SCREENS.DESTINATION, setReward);
  }

  // Helper to commit the chosen battle rewards or trinkets, or mixed potions into the run deck/inventory.
  function applyFinalizedRewards(result: ReturnType<typeof finalizeRewardState>) {
    if (result.selectedChoice) {
      applyRewardSelection({
        choice: result.selectedChoice,
        type: result.selectedRewardType,
        setRunDeck: run.setRunDeck,
        setRunTrinkets: run.setRunTrinkets,
        setDiscoveredCardIds,
        setDiscoveredTrinketIds,
      });
      playUISound("talentUnlock");
    }

    if (result.grantAlchemistReward) {
      applyAlchemistPotion({
        setRunDeck: run.setRunDeck,
        setDiscoveredCardIds,
      });
    }
  }

  function finishRewards() {
    const battleStateVal = useBattleStore.getState().logicalBattleState;
    const result = finalizeRewardState({
      rewardState,
      companionRewardCards,
      contentSystemType: run.contentSystemType,
      currentEnemyType: battleStateVal.currentEnemy.enemyType,
      grantAlchemistReward: shouldGrantAlchemistReward(
        getActiveRewardModifiersForContentSystem(run.contentSystemType, activeLabyrinthRewardModifiers),
      ),
    });

    useHomesteadStore.getState().addMaterials(result.materials);
    applyFinalizedRewards(result);
    setHoveredCardId(null);
    executeRewardRouteTransition(
      result.route,
      result.materials,
      result.nextRewardState,
      result.clearCompanionRewardCards,
    );
  }

  function handleDestinationChoice(destination: Destination) {
    const selectedBossId = destination === CONSTANTS.DESTINATIONS.BOSS_COMBAT ? rewardState.selectedBossId : null;
    run.setCompletedDestinations((prev) => [...prev, destination]);
    run.setDestinationIndexInAct((p) => p + 1);
    setHoveredCardId(null);
    routeDestinationChoice(destination, {
      navigateTo,
      beginMysteryEvent,
      resetCorruption: () => getStore().setCorruptionResult(null),
      startShop: onInitShop,
      startAlchemist: onInitAlchemist,
      startBattle: (enemyType) => onStartBattle(undefined, undefined, enemyType),
      startBossBattle: () => {
        if (selectedBossId && onStartBossById(selectedBossId)) return;
        onStartBossBattle();
      },
    });
  }

  function beginMysteryEvent() {
    mystery.beginMysteryEvent(() => navigateTo(CONSTANTS.SCREENS.MYSTERY));
    playUISound("musicBoxMystery");
  }

  function endLabyrinthRun() {
    if (run.contentSystemType !== CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) return;
    awardRunEndMaterials();
    talents.finalizeRunXP();
    stopAllSfx();
    playDefeat();
    clearCombatState();
    getStore().setHasActiveRun(false);
    setScreen(CONSTANTS.SCREENS.GAME_OVER);
  }

  function handleActComplete(displayMaterials?: MaterialInventory) {
    setHoveredCardId(null);
    setHasActiveBattle(false);

    if (run.currentAct >= ACTS_PER_RUN) {
      if (run.selectedDifficulty) {
        onMarkDifficultyCompleted(run.characterId, run.selectedDifficulty);
      }
      completeRunVictory(displayMaterials);
      return;
    }

    run.setCurrentAct((p) => p + 1);
    run.setDestinationIndexInAct(0);
    run.setCompletedDestinations([]);
    navigateTo(CONSTANTS.SCREENS.DESTINATION, () => {
      getStore().setRewardState(createInitialDestinations({ destinationIndexInAct: 0 }));
    });
  }

  function completeRunVictory(displayMaterials: MaterialInventory | null = null, onRenderedScreenCommit?: () => void) {
    awardRunEndMaterials(displayMaterials);
    talents.finalizeRunXP();
    setHasActiveBattle(false);
    getStore().setHasActiveRun(false);
    navigateTo(CONSTANTS.SCREENS.RUN_VICTORY, onRenderedScreenCommit);
  }

  function advanceToNextDestination() {
    run.setRoomsEncountered((p) => p + 1);
    if (run.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
      onLabyrinthClearNode();
      setHoveredCardId(null);
      navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP);
      return;
    }
    const prevDest =
      run.destinationIndexInAct === 0 ? undefined : run.completedDestinations[run.completedDestinations.length - 1];
    setHoveredCardId(null);
    mystery.clearCardChoices();
    navigateTo(CONSTANTS.SCREENS.DESTINATION, () => {
      getStore().setRewardState(createInitialDestinations(undefined, prevDest));
    });
  }

  function handleCampfireContinue() {
    const healFraction = CAMPFIRE_HEAL_FRACTION + talents.talentEffects.campfireHealBonus;
    run.setRunPlayerHealth((prev) => Math.min(run.runMaxHealth, prev + Math.floor(run.runMaxHealth * healFraction)));
    advanceToNextDestination();
  }

  // ============ Corruption ============

  function handleCorruptCard(cardIndex: number) {
    const { deck, result } = corruptDeckCard(run.runDeck, cardIndex);
    run.setRunDeck(deck);
    getStore().setCorruptionResult(result);
    setDiscoveredCardIds((current) => appendUnique(current, result.corruptedCard.id));
    playUISound("musicBoxMystery");
  }

  function handleCorruptionContinue() {
    advanceToNextDestination();
  }
  function handleCorruptionLeave() {
    advanceToNextDestination();
  }

  // ============ Mystery ============

  const handleMysteryChoice = mystery.handleMysteryChoice;
  const handleMysteryChooseCard = mystery.handleMysteryChooseCard;
  const handleMysteryRemoveCard = mystery.handleMysteryRemoveCard;
  const handleMysteryContinue = mystery.handleMysteryContinue;

  // ============ State Reset ============

  function resetRunState() {
    rewardTransitionTimer.current.clearAll();
    clearCardGhosts();
    setHoveredCardId(null);
    setHasActiveBattle(false);
    navigateTo(CONSTANTS.SCREENS.MENU, () => {
      resetActiveRunStores();
    });
  }

  return {
    screen,
    setScreen,
    rewardState,
    setRewardState: getStore().setRewardState,
    setSelectedRewardId: (id: string | null) => getStore().setRewardState((p) => ({ ...p, selectedId: id })),
    get rewardChoices() {
      return rewardState.choices;
    },
    get rewardGold() {
      return rewardState.gold;
    },
    get rewardMaterials() {
      return rewardState.materials;
    },
    get rewardType() {
      return rewardState.rewardType;
    },
    get selectedRewardId() {
      return rewardState.selectedId;
    },
    get destinationOptions() {
      return rewardState.destinations;
    },
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
    advanceToNextDestination,
    beginCampaign,
    beginLabyrinth,
    beginWildwood,
    beginMysteryEvent,
    endLabyrinthRun,
    handleCharacterSelect,
    handleDraftComplete,
    handleDifficultySelect,
    handleBackFromDifficultySelect,
    handleWildwoodBossSelect,
    returnToBattle,
    goToScreen,
    handleDestinationChoice,
    handleActComplete,
    finishRewards,
    handleCampfireContinue,
    handleCorruptCard,
    handleCorruptionContinue,
    handleCorruptionLeave,
    handleMysteryChoice,
    handleMysteryChooseCard,
    handleMysteryRemoveCard,
    handleMysteryContinue,
    resetRunState,
    handleBattleVictory,
    handleBattleDefeat,
  };
}
