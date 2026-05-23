// Run-flow controller for routing, rewards, mysteries, campfires, act transitions, and reset.
// Depends on: useScreenStore, battle system, game constants, audio registry, and navigation flow helpers.
// Depended on by: useAlchemyRunController for managing the overall flow of a run.
import { useEffect, useMemo, useRef, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { useRunStore } from "./stores/run-store";
import { useAppStore } from "./stores/app-store";
import { useHomesteadStore } from "./stores/homestead-store";
import { useBattleStore } from "./stores/battle-store";
import { defaultBattleState, isPlayerDefeated, type BattleState } from "@/lib/battle";
import {
  getDifficultyModifiers,
  getGoldMultiplier,
  computeTalentEffects,
  type BattleCard,
  type CharacterId,
  type DifficultyId,
  type DifficultyModifier,
  type UnlockedTalents,
} from "@/lib/game-data";
import { playVictory, playDefeat, playGoldGain, stopAllSfx } from "@/lib/audio";
import { appendUnique, appendUniqueMany } from "@/lib/utils";
import { CONSTANTS, type Destination, type Screen } from "./types";
import { applyMaterialFindBonus, getEnemyMaterialLoot } from "@/lib/homestead/loot";
import { addInventory } from "@/lib/homestead/inventory";
import { type MaterialInventory, type HomesteadEffectManifest } from "@/lib/homestead/types";
import {
  ACTS_PER_RUN,
  CAMPFIRE_HEAL_FRACTION,
  COMPANION_GOLD_FIND_CHANCE,
  COMPANION_GOLD_MULTIPLIER,
  DEFAULT_BATTLE_ENEMY_TYPE,
  DEFAULT_CAMPAIGN_DIFFICULTY_ID,
  ELITE_GOLD_BONUS_FRACTION,
  BOSS_GOLD_BONUS_FRACTION,
  GOLD_REWARD_MAX,
  GOLD_REWARD_MIN,
  VICTORY_TRANSITION_DELAY,
} from "@/lib/game-constants";
import { randomBetween } from "./utils";
import { getRunAvailableDestinations, sampleDestinationChoices } from "./navigation/destination-flow";
import {
  createBossRewardState as createBossRewardStateFromFlow,
  createCombatRewardState as createCombatRewardStateFromFlow,
  createEmptyRewardState,
  computeVictoryGoldResult,
  applyLabyrinthRewardMaterialModifiers,
  getActiveRewardModifiersForContentSystem,
  getGenerousGoldBonus,
  getCompanionCardChoices,
  getRandomPotionCard,
  shouldForceTrinketReward,
  shouldGrantAlchemistReward,
  shouldGrantCompanionReward,
  finalizeRewardState,
  type RewardState,
} from "./navigation/reward-flow";
import { useMysteryFlow } from "./navigation/use-mystery-flow";
import { routeDestinationChoice } from "./navigation/routing-flow";
import { createActiveRunData } from "./run/active-run-data";
import { createRunStartSnapshot, type RunStartSnapshot } from "./run/run-start";
import { corruptDeckCard } from "./corruption";
import type { ContentSystemId, LabyrinthModifierKind } from "@/lib/content-systems/types";
import { useScreenStore } from "./stores/screen-store";
import { getBossEnemy } from "./config";

type DestinationOptionsInput = {
  currentHealth?: number;
  currentGold?: number;
  destinationIndexInAct?: number;
  maxHealth?: number;
};

// Boss previews and encounters must share one random selection for the destination.
// Prevents the boss node from rerolling the boss choice if the user re-renders or checks the node before combat.
function withSelectedBossForDestinations(destinations: Destination[], rewardState: RewardState): RewardState {
  if (destinations.length === 1 && destinations[0] === CONSTANTS.DESTINATIONS.BOSS_COMBAT) {
    return { ...rewardState, selectedBossId: rewardState.selectedBossId ?? getBossEnemy().id };
  }
  return { ...rewardState, selectedBossId: null };
}

function createDestinationRewardState(destinations: Destination[]): RewardState {
  return withSelectedBossForDestinations(destinations, createEmptyRewardState(destinations));
}

function calculateVictoryGold({
  unlockedTalents,
  activeCompanion,
  currentEnemy,
  labyrinthRewardModifiers,
}: {
  unlockedTalents: UnlockedTalents;
  activeCompanion: { id: string } | null;
  currentEnemy: { enemyType: string };
  labyrinthRewardModifiers: LabyrinthModifierKind[];
}) {
  const baseGold = randomBetween(GOLD_REWARD_MIN, GOLD_REWARD_MAX);
  const talentEffects = computeTalentEffects(unlockedTalents);

  let gold = Math.floor(baseGold * (1 + talentEffects.enemyGoldDropBonus));

  if (talentEffects.companionGoldFindActive && activeCompanion && Math.random() < COMPANION_GOLD_FIND_CHANCE) {
    gold = Math.floor(gold * COMPANION_GOLD_MULTIPLIER);
  }

  const eliteFraction =
    ELITE_GOLD_BONUS_FRACTION +
    (currentEnemy.enemyType === CONSTANTS.ENEMY_TYPES.ELITE ? talentEffects.eliteGoldDropBonus : 0);
  const eliteBonus = currentEnemy.enemyType === CONSTANTS.ENEMY_TYPES.ELITE ? Math.floor(gold * eliteFraction) : 0;
  const bossBonus =
    currentEnemy.enemyType === CONSTANTS.ENEMY_TYPES.BOSS ? Math.floor(gold * BOSS_GOLD_BONUS_FRACTION) : 0;
  const generousBonus = getGenerousGoldBonus(labyrinthRewardModifiers, gold);

  return { gold, eliteBonus, bossBonus, generousBonus };
}

function awardVictoryGold({
  characterId,
  selectedDifficulty,
  unlockedTalents,
  battleState,
  runGold,
  runTrinkets,
  gold,
  eliteBonus,
  generousBonus,
  bossBonus,
  addRunGold,
}: {
  characterId: CharacterId;
  selectedDifficulty: DifficultyId | null;
  unlockedTalents: UnlockedTalents;
  battleState: BattleState;
  runGold: number;
  runTrinkets: string[];
  gold: number;
  eliteBonus: number;
  generousBonus: number;
  bossBonus: number;
  addRunGold: (amount: number) => void;
}) {
  const talentEffects = computeTalentEffects(unlockedTalents);

  const goldResult = computeVictoryGoldResult({
    battleState,
    runGold,
    runTrinkets,
    gold,
    eliteBonus,
    generousBonus,
    bossBonus,
    talentGoldPerCombat: talentEffects.goldPerCombat,
    goldMultiplier: getGoldMultiplier(characterId, selectedDifficulty),
  });
  addRunGold(goldResult.earnedBeforeMultiplier);
  return goldResult.persistedRunGold;
}

function applyPlayerVictoryStats({
  unlockedTalents,
  battleState,
  setRunPlayerHealth,
  setRunMaxHealth,
}: {
  unlockedTalents: UnlockedTalents;
  battleState: BattleState;
  setRunPlayerHealth: (health: number) => void;
  setRunMaxHealth: (fn: (max: number) => number) => void;
}) {
  const talentEffects = computeTalentEffects(unlockedTalents);

  setRunPlayerHealth(battleState.playerHealth);
  if (talentEffects.maxHealthPerCombat > 0) {
    setRunMaxHealth((p) => p + talentEffects.maxHealthPerCombat);
  }
}

function getVictoryMaterials(enemyId: string, enemyType: string, homesteadEffects: HomesteadEffectManifest) {
  return applyMaterialFindBonus(getEnemyMaterialLoot(enemyId, enemyType), homesteadEffects);
}

function createBossRewardState({
  characterId,
  selectedDifficulty,
  unlockedTalents,
  runTrinkets,
  gold,
  bossBonus,
  generousBonus,
  materials,
}: {
  characterId: CharacterId;
  selectedDifficulty: DifficultyId | null;
  unlockedTalents: UnlockedTalents;
  runTrinkets: string[];
  gold: number;
  bossBonus: number;
  generousBonus: number;
  materials: MaterialInventory;
}) {
  const talentEffects = computeTalentEffects(unlockedTalents);
  const goldMultiplier = getGoldMultiplier(characterId, selectedDifficulty);
  return createBossRewardStateFromFlow({
    gold,
    bossBonus,
    generousBonus,
    talentGoldPerCombat: talentEffects.goldPerCombat,
    materials,
    trinketIds: runTrinkets,
    goldMultiplier,
  });
}

function createCombatRewardState({
  characterId,
  selectedDifficulty,
  unlockedTalents,
  runDeck,
  runTrinkets,
  contentSystemType,
  activeLabyrinthRewardModifiers,
  battleState,
  gold,
  eliteBonus,
  generousBonus,
  materials,
  destinations,
}: {
  characterId: CharacterId;
  selectedDifficulty: DifficultyId | null;
  unlockedTalents: UnlockedTalents;
  runDeck: BattleCard[];
  runTrinkets: string[];
  contentSystemType: ContentSystemId;
  activeLabyrinthRewardModifiers: LabyrinthModifierKind[];
  battleState: BattleState;
  gold: number;
  eliteBonus: number;
  generousBonus: number;
  materials: MaterialInventory;
  destinations: Destination[];
}) {
  const talentEffects = computeTalentEffects(unlockedTalents);
  const goldMultiplier = getGoldMultiplier(characterId, selectedDifficulty);
  return withSelectedBossForDestinations(
    destinations,
    createCombatRewardStateFromFlow({
      battleState,
      runDeck,
      gold,
      eliteBonus,
      generousBonus,
      talentGoldPerCombat: talentEffects.goldPerCombat,
      materials,
      destinations,
      trinketIds: runTrinkets,
      goldMultiplier,
      forceTrinket: shouldForceTrinketReward(
        getActiveRewardModifiersForContentSystem(contentSystemType, activeLabyrinthRewardModifiers),
      ),
    }),
  );
}

function createVictoryRewardState({
  characterId,
  selectedDifficulty,
  unlockedTalents,
  runDeck,
  runTrinkets,
  contentSystemType,
  activeLabyrinthRewardModifiers,
  battleState,
  gold,
  eliteBonus,
  generousBonus,
  bossBonus,
  materials,
  destinations,
}: {
  characterId: CharacterId;
  selectedDifficulty: DifficultyId | null;
  unlockedTalents: UnlockedTalents;
  runDeck: BattleCard[];
  runTrinkets: string[];
  contentSystemType: ContentSystemId;
  activeLabyrinthRewardModifiers: LabyrinthModifierKind[];
  battleState: BattleState;
  gold: number;
  eliteBonus: number;
  generousBonus: number;
  bossBonus: number;
  materials: MaterialInventory;
  destinations: Destination[];
}) {
  if (battleState.currentEnemy.enemyType === CONSTANTS.ENEMY_TYPES.BOSS) {
    return createBossRewardState({
      characterId,
      selectedDifficulty,
      unlockedTalents,
      runTrinkets,
      gold,
      bossBonus,
      generousBonus,
      materials,
    });
  }
  return createCombatRewardState({
    characterId,
    selectedDifficulty,
    unlockedTalents,
    runDeck,
    runTrinkets,
    contentSystemType,
    activeLabyrinthRewardModifiers,
    battleState,
    gold,
    eliteBonus,
    generousBonus,
    materials,
    destinations,
  });
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
  const runStoreFields = useRunStore(
    useShallow((s) => ({
      characterId: s.characterId,
      runDeck: s.runDeck,
      runGold: s.runGold,
      runPlayerHealth: s.runPlayerHealth,
      runMaxHealth: s.runMaxHealth,
      roomsEncountered: s.roomsEncountered,
      currentAct: s.currentAct,
      destinationIndexInAct: s.destinationIndexInAct,
      completedDestinations: s.completedDestinations,
      runTrinkets: s.runTrinkets,
      encounteredRunEnemyIds: s.encounteredRunEnemyIds,
      selectedDifficulty: s.selectedDifficulty,
      contentSystemType: s.contentSystemType,
      unlockedTalents: s.unlockedTalents,
    })),
  );

  const runStoreActions = useRunStore(
    useShallow((s) => ({
      setRunDeck: s.setRunDeck,
      setRunGold: s.setRunGold,
      setRunPlayerHealth: s.setRunPlayerHealth,
      setRunMaxHealth: s.setRunMaxHealth,
      setRoomsEncountered: s.setRoomsEncountered,
      setCurrentAct: s.setCurrentAct,
      setDestinationIndexInAct: s.setDestinationIndexInAct,
      setCompletedDestinations: s.setCompletedDestinations,
      setRunTrinkets: s.setRunTrinkets,
      setEncounteredRunEnemyIds: s.setEncounteredRunEnemyIds,
      setSelectedDifficulty: s.setSelectedDifficulty,
      setContentSystemType: s.setContentSystemType,
      setCharacter: s.setCharacter,
      reset: s.reset,
      addRunGold: s.addRunGold,
      awardMysteryXP: s.awardMysteryXP,
      resetRunXP: s.resetRunXP,
    })),
  );

  const run = useMemo(() => ({ ...runStoreFields, ...runStoreActions }), [runStoreFields, runStoreActions]);
  const talentEffects = useMemo(
    () => computeTalentEffects(runStoreFields.unlockedTalents),
    [runStoreFields.unlockedTalents],
  );
  const talents = useMemo(
    () => ({
      talentEffects,
      awardMysteryXP: runStoreActions.awardMysteryXP,
      resetRunXP: runStoreActions.resetRunXP,
    }),
    [talentEffects, runStoreActions.awardMysteryXP, runStoreActions.resetRunXP],
  );

  const battleState = useBattleStore((s) => s.battleState);
  const hasActiveBattle = useBattleStore((s) => s.hasActiveBattle);
  const setHasActiveBattle = useBattleStore((s) => s.setHasActiveBattle);
  const setBattleState = useBattleStore((s) => s.setBattleState);
  const clearCardGhosts = useBattleStore((s) => s.clearCardGhosts);

  const { completedDifficulties, setDiscoveredCardIds, setEncounteredEnemyIds, setDiscoveredTrinketIds } = useAppStore(
    useShallow((s) => ({
      completedDifficulties: s.completedDifficulties,
      setDiscoveredCardIds: s.setDiscoveredCardIds,
      setEncounteredEnemyIds: s.setEncounteredEnemyIds,
      setDiscoveredTrinketIds: s.setDiscoveredTrinketIds,
    })),
  );

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
  const battleVictoryHandledRef = useRef(false);
  const rewardTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearRewardTransitionTimer() {
    if (!rewardTransitionTimerRef.current) return;
    clearTimeout(rewardTransitionTimerRef.current);
    rewardTransitionTimerRef.current = null;
  }

  useEffect(() => clearRewardTransitionTimer, []);

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
        battleState,
        labyrinthPendingNode,
        activeLabyrinthModifiers,
        activeLabyrinthRewardModifiers,
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
      battleState,
      labyrinthPendingNode,
      activeLabyrinthModifiers,
      activeLabyrinthRewardModifiers,
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
      const baseHerbs = homesteadEffects.herbFindBonus > 0 ? run.roomsEncountered : 0;
      const food = homesteadEffects.companionDamage > 0 ? run.roomsEncountered : 0;
      const mats = applyMaterialFindBonus({ wood: 0, iron: 0, herbs: baseHerbs, food, crystal: 0 }, homesteadEffects);
      if (mats.herbs > 0 || food > 0) useHomesteadStore.getState().addMaterials(mats);
      getStore().setRunEndMaterials(displayMaterials ? addInventory(displayMaterials, mats) : mats);
      return mats;
    },
    [run.roomsEncountered],
  );

  // ============ Victory / Defeat Effects ============

  const handleBattleDefeat = useCallback(() => {
    clearRewardTransitionTimer();
    const runState = useRunStore.getState();
    if (runState.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
      stopAllSfx();
      onLabyrinthFailNode();
      useBattleStore.getState().setHasActiveBattle(false);
      useScreenStore.getState().setHoveredCardId(null);
      navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP);
      return;
    }
    awardRunEndMaterials();
    stopAllSfx();
    playDefeat();
    useBattleStore.getState().setHasActiveBattle(false);
    useScreenStore.getState().setHoveredCardId(null);
    setScreen(CONSTANTS.SCREENS.GAME_OVER);
  }, [navigateTo, setScreen, onLabyrinthFailNode, awardRunEndMaterials]);

  const handleBattleVictory = useCallback(() => {
    clearRewardTransitionTimer();
    const runState = useRunStore.getState();
    const activeLabyrinthRewardModifiers = useScreenStore.getState().activeLabyrinthRewardModifiers;
    const battleState = useBattleStore.getState().battleState;

    const labyrinthRewardModifiers = getActiveRewardModifiersForContentSystem(
      runState.contentSystemType,
      activeLabyrinthRewardModifiers,
    );
    const { gold, eliteBonus, bossBonus, generousBonus } = calculateVictoryGold({
      unlockedTalents: runState.unlockedTalents,
      activeCompanion: battleState.activeCompanion,
      currentEnemy: battleState.currentEnemy,
      labyrinthRewardModifiers,
    });
    const newGold = awardVictoryGold({
      characterId: runState.characterId,
      selectedDifficulty: runState.selectedDifficulty,
      unlockedTalents: runState.unlockedTalents,
      battleState,
      runGold: runState.runGold,
      runTrinkets: runState.runTrinkets,
      gold,
      eliteBonus,
      generousBonus,
      bossBonus,
      addRunGold: runState.addRunGold,
    });

    applyPlayerVictoryStats({
      unlockedTalents: runState.unlockedTalents,
      battleState,
      setRunPlayerHealth: runState.setRunPlayerHealth,
      setRunMaxHealth: runState.setRunMaxHealth,
    });
    if (newGold > battleState.gold) playGoldGain();

    const homesteadEffects = useHomesteadStore.getState().effects;
    const materials = applyLabyrinthRewardMaterialModifiers(
      getVictoryMaterials(battleState.currentEnemy.id, battleState.currentEnemy.enemyType, homesteadEffects),
      labyrinthRewardModifiers,
    );

    const destinations = sampleDestinationChoices(
      getAvailableDestinations({ currentHealth: battleState.playerHealth, currentGold: newGold }),
    );

    const rewardStateObj = createVictoryRewardState({
      characterId: runState.characterId,
      selectedDifficulty: runState.selectedDifficulty,
      unlockedTalents: runState.unlockedTalents,
      runDeck: runState.runDeck,
      runTrinkets: runState.runTrinkets,
      contentSystemType: runState.contentSystemType,
      activeLabyrinthRewardModifiers,
      battleState,
      gold,
      eliteBonus,
      generousBonus,
      bossBonus,
      materials,
      destinations,
    });

    useScreenStore.getState().setRewardState(rewardStateObj);

    if (shouldGrantCompanionReward(labyrinthRewardModifiers)) {
      useScreenStore.getState().setCompanionRewardCards(getCompanionCardChoices());
    } else {
      useScreenStore.getState().setCompanionRewardCards(null);
    }

    useBattleStore.getState().setHasActiveBattle(false);
    useScreenStore.getState().setHoveredCardId(null);
    stopAllSfx();
    playVictory();

    rewardTransitionTimerRef.current = setTimeout(() => {
      rewardTransitionTimerRef.current = null;
      setScreen(CONSTANTS.SCREENS.REWARDS);
    }, VICTORY_TRANSITION_DELAY);
  }, [setScreen, getAvailableDestinations]);

  useEffect(() => {
    if (screen !== CONSTANTS.SCREENS.BATTLE || !isPlayerDefeated(battleState)) return;
    handleBattleDefeat();
  }, [battleState, screen, handleBattleDefeat]);

  useEffect(() => {
    if (screen === CONSTANTS.SCREENS.BATTLE && hasActiveBattle && battleState.enemyHealth > 0)
      battleVictoryHandledRef.current = false;
  }, [battleState.enemyHealth, hasActiveBattle, screen]);

  useEffect(() => {
    if (screen !== CONSTANTS.SCREENS.BATTLE || !hasActiveBattle || battleState.enemyHealth > 0) return;
    if (isPlayerDefeated(battleState)) return;
    if (battleVictoryHandledRef.current) return;
    battleVictoryHandledRef.current = true;
    handleBattleVictory();
  }, [battleState, hasActiveBattle, screen, handleBattleVictory]);

  // ============ Content System Flow ============

  function beginCampaign() {
    if (hasActiveBattle && run.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN) {
      returnToBattle();
      return;
    }
    if (hasActiveRun && run.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN) {
      getStore().setRewardState((prev) => {
        const destinations =
          prev.destinations.length > 0 ? prev.destinations : sampleDestinationChoices(getAvailableDestinations());
        return withSelectedBossForDestinations(destinations, { ...prev, destinations });
      });
      navigateTo(CONSTANTS.SCREENS.DESTINATION);
      return;
    }
    getStore().setPendingContentSystemType(CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN);
    navigateTo(CONSTANTS.SCREENS.CHARACTER_SELECT);
  }

  function beginLabyrinth() {
    if (hasActiveBattle && run.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
      returnToBattle();
      return;
    }
    if (hasActiveRun && run.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
      navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP);
      return;
    }
    getStore().setPendingContentSystemType(CONSTANTS.CONTENT_SYSTEMS.LABYRINTH);
    navigateTo(CONSTANTS.SCREENS.CHARACTER_SELECT);
  }

  function beginWildwood() {
    getStore().setPendingContentSystemType(CONSTANTS.CONTENT_SYSTEMS.WILDWOOD);
    navigateTo(CONSTANTS.SCREENS.CHARACTER_SELECT);
  }

  function handleCharacterSelect(selectedId: CharacterId) {
    const systemType = pendingContentSystemType;
    if (systemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
      initializeLabyrinthRun(selectedId);
      return;
    }
    if (systemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
      initializeWildwoodRun(selectedId);
      return;
    }
    if (systemType !== CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN) {
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

  function initializeLabyrinthRun(characterId: CharacterId) {
    startRun(characterId, CONSTANTS.CONTENT_SYSTEMS.LABYRINTH, { discoverStarterDeck: true, playStartGoldSound: true });
    navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP);
  }

  function initializeWildwoodRun(characterId: CharacterId) {
    startRun(characterId, CONSTANTS.CONTENT_SYSTEMS.WILDWOOD);
    navigateTo(CONSTANTS.SCREENS.WILDWOOD_SELECT);
  }

  function initializeRunForDifficulty(characterId: CharacterId, difficultyId: DifficultyId) {
    const snapshot = startRun(characterId, CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN, {
      difficultyId,
      discoverStarterDeck: true,
      playStartGoldSound: true,
      resetEncounteredEnemies: true,
    });
    getStore().setRewardState(
      createDestinationRewardState(
        sampleDestinationChoices(
          getAvailableDestinations({
            currentHealth: snapshot.runMaxHealth,
            currentGold: snapshot.runGold,
            destinationIndexInAct: 0,
            maxHealth: snapshot.runMaxHealth,
          }),
        ),
      ),
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
    if (options.playStartGoldSound && snapshot.runGold > 0) playGoldGain();
    if (options.discoverStarterDeck) {
      setDiscoveredCardIds((current) =>
        appendUniqueMany(
          current,
          snapshot.freshDeck.map((c) => c.id),
        ),
      );
    }
    if (options.resetEncounteredEnemies) setEncounteredEnemyIds([]);
    setHoveredCardId(null);
    return snapshot;
  }

  function createStartSnapshot(
    characterId: CharacterId,
    contentSystemType: ContentSystemId,
    difficultyId?: DifficultyId | null,
  ) {
    const homesteadEffects = useHomesteadStore.getState().effects;
    return createRunStartSnapshot({
      characterId,
      contentSystemType,
      difficultyId,
      talentStartGold: talents.talentEffects.startGold,
      homesteadStartGold: homesteadEffects.startGold,
      homesteadStartMaxHealthBonus: homesteadEffects.startMaxHealthBonus,
    });
  }

  function applyRunStartSnapshot(snapshot: RunStartSnapshot) {
    run.setContentSystemType(snapshot.contentSystemType);
    run.setCharacter(snapshot.characterId);
    run.setRunDeck(snapshot.freshDeck);
    run.setSelectedDifficulty(snapshot.selectedDifficulty);
    run.setRunGold(snapshot.runGold);
    run.setRunPlayerHealth(snapshot.runPlayerHealth);
    run.setRunMaxHealth(snapshot.runMaxHealth);
    run.setRoomsEncountered(snapshot.roomsEncountered);
    run.setCurrentAct(snapshot.currentAct);
    run.setDestinationIndexInAct(snapshot.destinationIndexInAct);
    run.setCompletedDestinations(snapshot.completedDestinations);
    run.setEncounteredRunEnemyIds([]);
    run.setRunTrinkets(snapshot.runTrinkets);
    getStore().setHasActiveRun(snapshot.hasActiveRun);
  }

  function handleDifficultySelect(difficultyId: DifficultyId) {
    if (!pendingCharacterId) return;
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

  function applySelectedChoiceReward(
    selectedChoice: BattleCard | { id: string } | null,
    selectedRewardType: RewardState["rewardType"],
  ) {
    if (!selectedChoice) return;
    const selectedId = selectedChoice.id;
    if (selectedRewardType === "card") {
      run.setRunDeck((prev) => [...prev, selectedChoice as BattleCard]);
      setDiscoveredCardIds((cur) => appendUnique(cur, selectedId));
    } else {
      run.setRunTrinkets((prev) => [...prev, selectedId]);
      setDiscoveredTrinketIds((cur) => appendUnique(cur, selectedId));
    }
  }

  function applyAlchemistPotionReward(grantAlchemistReward: boolean) {
    if (!grantAlchemistReward) return;
    const potion = getRandomPotionCard();
    run.setRunDeck((prev) => [...prev, potion]);
    setDiscoveredCardIds((cur) => appendUnique(cur, potion.id));
  }

  type FinalizeRewardResultType = ReturnType<typeof finalizeRewardState>;

  function executeRewardRouteTransition(
    route: FinalizeRewardResultType["route"],
    materials: MaterialInventory,
    nextRewardState: RewardState,
    clearCompanionRewardCards: boolean,
  ) {
    const store = getStore();
    switch (route) {
      case CONSTANTS.REWARD_ROUTES.COMPANION_REWARD:
        store.setRewardState(nextRewardState);
        if (clearCompanionRewardCards) {
          store.setCompanionRewardCards(null);
        }
        navigateTo(CONSTANTS.SCREENS.REWARDS);
        break;

      case CONSTANTS.REWARD_ROUTES.LABYRINTH_VICTORY:
      case CONSTANTS.REWARD_ROUTES.WILDWOOD_VICTORY:
        completeRunVictory(materials, () => store.setRewardState(nextRewardState));
        break;

      case CONSTANTS.REWARD_ROUTES.LABYRINTH_MAP:
        onLabyrinthClearNode();
        navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP, () => store.setRewardState(nextRewardState));
        break;

      case CONSTANTS.REWARD_ROUTES.ACT_COMPLETE:
        handleActComplete(materials);
        break;

      default:
        navigateTo(CONSTANTS.SCREENS.DESTINATION, () => store.setRewardState(nextRewardState));
        break;
    }
  }

  function finishRewards() {
    const battleStateVal = useBattleStore.getState().battleState;
    const currentEnemyType = battleStateVal.currentEnemy.enemyType;
    const result = finalizeRewardState({
      rewardState,
      companionRewardCards,
      contentSystemType: run.contentSystemType,
      currentEnemyType,
      grantAlchemistReward: shouldGrantAlchemistReward(
        getActiveRewardModifiersForContentSystem(run.contentSystemType, activeLabyrinthRewardModifiers),
      ),
    });

    useHomesteadStore.getState().addMaterials(result.materials);
    applySelectedChoiceReward(result.selectedChoice, result.selectedRewardType);
    applyAlchemistPotionReward(result.grantAlchemistReward);

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
  }

  function endLabyrinthRun() {
    if (run.contentSystemType !== CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) return;
    awardRunEndMaterials();
    stopAllSfx();
    playDefeat();
    setHasActiveBattle(false);
    getStore().setHasActiveRun(false);
    setHoveredCardId(null);
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
    getStore().setRewardState(
      createDestinationRewardState(sampleDestinationChoices(getAvailableDestinations({ destinationIndexInAct: 0 }))),
    );
    navigateTo(CONSTANTS.SCREENS.DESTINATION);
  }

  function completeRunVictory(displayMaterials: MaterialInventory | null = null, onRenderedScreenCommit?: () => void) {
    awardRunEndMaterials(displayMaterials);
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
    getStore().setRewardState(createDestinationRewardState(sampleDestinationChoices(getAvailableDestinations())));
    setHoveredCardId(null);
    mystery.clearCardChoices();
    navigateTo(CONSTANTS.SCREENS.DESTINATION);
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
    clearRewardTransitionTimer();
    clearCardGhosts();
    setHoveredCardId(null);
    setHasActiveBattle(false);
    navigateTo(CONSTANTS.SCREENS.MENU, () => {
      setBattleState(defaultBattleState());
      run.reset();
      talents.resetRunXP();
      getStore().setPendingContentSystemType(CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN);
      getStore().setRewardState(createEmptyRewardState());
      mystery.clearCardChoices();
      getStore().setHasActiveRun(false);
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
  };
}
