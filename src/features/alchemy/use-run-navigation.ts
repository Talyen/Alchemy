// Run-flow controller for routing, rewards, mysteries, campfires, act transitions, and reset.
// Depends on: useScreenStore, battle system, game constants, audio registry, and navigation flow helpers.
// Depended on by: useAlchemyRunController for managing the overall flow of a run.
import { useEffect, useMemo, useRef } from "react";
import { defaultBattleState, isPlayerDefeated } from "@/lib/battle";
import {
  getDifficultyModifiers,
  getGoldMultiplier,
  type BattleCard,
  type CharacterId,
  type DifficultyId,
  type DifficultyModifier,
} from "@/lib/game-data";
import { playVictory, playDefeat, playGoldGain, stopAllSfx } from "@/lib/audio";
import { appendUnique, appendUniqueMany } from "@/lib/utils";
import { CONSTANTS, type Destination, type Screen } from "./types";
import { applyMaterialFindBonus, getEnemyMaterialLoot } from "@/lib/homestead/loot";
import { addInventory } from "@/lib/homestead/inventory";
import { type HomesteadEffectManifest, type MaterialInventory } from "@/lib/homestead/types";
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
import type { BattleState } from "@/lib/battle";
import type { RunStateController } from "./use-run-state";
import type { TalentStateController } from "./use-talent-state";
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
import type { ContentSystemId, LabyrinthMap, LabyrinthModifierKind } from "@/lib/content-systems/types";
import { useScreenStore } from "./stores/screen-store";
import { getBossEnemy } from "./config";

type DestinationOptionsInput = {
  currentHealth?: number;
  currentGold?: number;
  destinationIndexInAct?: number;
  maxHealth?: number;
};

function isRunVictoryRewardRoute(route: string) {
  return route === CONSTANTS.REWARD_ROUTES.LABYRINTH_VICTORY || route === CONSTANTS.REWARD_ROUTES.WILDWOOD_VICTORY;
}

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

export function useRunNavigation({
  run,
  talents,
  screen,
  setScreen,
  navigateTo,
  battleState,
  hasActiveBattle,
  setHasActiveBattle,
  hasActiveRun,
  currentEnemyType,
  clearCardGhosts,
  setBattleState,
  setDiscoveredCardIds,
  setEncounteredEnemyIds,
  setDiscoveredTrinketIds,
  onAddMaterialsRef,
  homesteadEffectsRef,
  setHoveredCardId,
  onStartBattle,
  onStartBossBattle,
  onStartBossById,
  onLabyrinthClearNode,
  onLabyrinthFailNode,
  onInitShop,
  onInitAlchemist,
  onMarkDifficultyCompleted,
  completedDifficulties,
  labyrinthMap,
  activeLabyrinthRewardModifiers,
}: {
  run: RunStateController;
  talents: TalentStateController;
  screen: Screen;
  setScreen: React.Dispatch<React.SetStateAction<Screen>>;
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
  battleState: BattleState;
  hasActiveBattle: boolean;
  setHasActiveBattle: React.Dispatch<React.SetStateAction<boolean>>;
  hasActiveRun: boolean;
  currentEnemyType: string;
  clearCardGhosts: () => void;
  setBattleState: React.Dispatch<React.SetStateAction<BattleState>>;
  setDiscoveredCardIds: React.Dispatch<React.SetStateAction<string[]>>;
  setEncounteredEnemyIds: React.Dispatch<React.SetStateAction<string[]>>;
  setDiscoveredTrinketIds: React.Dispatch<React.SetStateAction<string[]>>;
  onAddMaterialsRef: React.MutableRefObject<(materials: MaterialInventory) => void>;
  homesteadEffectsRef: React.MutableRefObject<HomesteadEffectManifest>;
  setHoveredCardId: React.Dispatch<React.SetStateAction<string | null>>;
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
  completedDifficulties: Record<CharacterId, DifficultyId[]>;
  labyrinthMap: LabyrinthMap;
  activeLabyrinthRewardModifiers: LabyrinthModifierKind[];
}) {
  const rewardState = useScreenStore((s) => s.rewardState);
  const companionRewardCards = useScreenStore((s) => s.companionRewardCards);
  const runEndMaterials = useScreenStore((s) => s.runEndMaterials);
  const corruptionResult = useScreenStore((s) => s.corruptionResult);
  const pendingCharacterId = useScreenStore((s) => s.pendingCharacterId);
  const pendingContentSystemType = useScreenStore((s) => s.pendingContentSystemType);

  const destinationButtonRefs = useRef<Partial<Record<Destination, HTMLButtonElement | null>>>({});

  function getStore() {
    return useScreenStore.getState();
  }

  const mystery = useMysteryFlow({
    runMaxHealth: run.runMaxHealth,
    setRunDeck: run.setRunDeck,
    setRunGold: run.setRunGold,
    setRunPlayerHealth: run.setRunPlayerHealth,
    setRunTrinkets: run.setRunTrinkets,
    setDiscoveredCardIds,
    setDiscoveredTrinketIds,
    awardMysteryXP: talents.awardMysteryXP,
    onAddMaterials: (materials) =>
      onAddMaterialsRef.current(applyMaterialFindBonus(materials, homesteadEffectsRef.current)),
    advanceToNextDestination,
    onAwardGold: run.addRunGold,
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
        selectedDifficulty: run.selectedDifficulty,
        contentSystemType: run.contentSystemType,
        labyrinthMap,
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
      run.selectedDifficulty,
      run.contentSystemType,
      labyrinthMap,
    ],
  );

  function getAvailableDestinations(options: DestinationOptionsInput = {}): Destination[] {
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
  }

  // ============ Victory / Defeat Effects ============

  // To prevent closures from executing with stale state or triggering the useEffect hook on
  // every state change (which would cause duplicate battles, rewards, or transitions), we capture
  // the callback functions in mutable refs. This separates the synchronization triggers (e.g., enemy health <= 0)
  // from the state variables referenced inside the handlers.
  const handleBattleDefeatRef = useRef(handleBattleDefeat);
  const handleBattleVictoryRef = useRef(handleBattleVictory);
  useEffect(() => {
    handleBattleDefeatRef.current = handleBattleDefeat;
  });
  useEffect(() => {
    handleBattleVictoryRef.current = handleBattleVictory;
  });

  useEffect(() => {
    if (screen !== CONSTANTS.SCREENS.BATTLE || !isPlayerDefeated(battleState)) return;
    handleBattleDefeatRef.current();
  }, [battleState, screen]);

  useEffect(() => {
    if (screen === CONSTANTS.SCREENS.BATTLE && hasActiveBattle && battleState.enemyHealth > 0)
      battleVictoryHandledRef.current = false;
  }, [battleState.enemyHealth, hasActiveBattle, screen]);

  useEffect(() => {
    if (screen !== CONSTANTS.SCREENS.BATTLE || !hasActiveBattle || battleState.enemyHealth > 0) return;
    if (isPlayerDefeated(battleState)) return;
    if (battleVictoryHandledRef.current) return;
    battleVictoryHandledRef.current = true;
    handleBattleVictoryRef.current();
  }, [battleState, hasActiveBattle, screen]);

  function handleBattleDefeat() {
    clearRewardTransitionTimer();
    if (run.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
      stopAllSfx();
      onLabyrinthFailNode();
      setHasActiveBattle(false);
      setHoveredCardId(null);
      navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP);
      return;
    }
    awardRunEndMaterials();
    stopAllSfx();
    playDefeat();
    setHasActiveBattle(false);
    setHoveredCardId(null);
    setScreen(CONSTANTS.SCREENS.GAME_OVER);
  }

  function calculateVictoryGold(labyrinthRewardModifiers: LabyrinthModifierKind[]) {
    const baseGold = randomBetween(GOLD_REWARD_MIN, GOLD_REWARD_MAX);
    let gold = Math.floor(baseGold * (1 + talents.talentEffects.enemyGoldDropBonus));

    if (
      talents.talentEffects.companionGoldFindActive &&
      battleState.activeCompanion &&
      Math.random() < COMPANION_GOLD_FIND_CHANCE
    ) {
      gold = Math.floor(gold * COMPANION_GOLD_MULTIPLIER);
    }

    const eliteFraction =
      ELITE_GOLD_BONUS_FRACTION +
      (battleState.currentEnemy.enemyType === CONSTANTS.ENEMY_TYPES.ELITE
        ? talents.talentEffects.eliteGoldDropBonus
        : 0);
    const eliteBonus =
      battleState.currentEnemy.enemyType === CONSTANTS.ENEMY_TYPES.ELITE ? Math.floor(gold * eliteFraction) : 0;
    const bossBonus =
      battleState.currentEnemy.enemyType === CONSTANTS.ENEMY_TYPES.BOSS
        ? Math.floor(gold * BOSS_GOLD_BONUS_FRACTION)
        : 0;
    const generousBonus = getGenerousGoldBonus(labyrinthRewardModifiers, gold);

    return { gold, eliteBonus, bossBonus, generousBonus };
  }

  function applyPlayerVictoryStats() {
    run.setRunPlayerHealth(battleState.playerHealth);
    if (talents.talentEffects.maxHealthPerCombat > 0) {
      run.setRunMaxHealth((p) => p + talents.talentEffects.maxHealthPerCombat);
    }
  }

  function setupVictoryRewards(
    gold: number,
    eliteBonus: number,
    generousBonus: number,
    bossBonus: number,
    newGold: number,
    labyrinthRewardModifiers: LabyrinthModifierKind[],
  ) {
    const materials = applyLabyrinthRewardMaterialModifiers(getVictoryMaterials(), labyrinthRewardModifiers);
    getStore().setRewardState(createVictoryRewardState(gold, eliteBonus, generousBonus, bossBonus, newGold, materials));
    if (shouldGrantCompanionReward(labyrinthRewardModifiers)) {
      getStore().setCompanionRewardCards(getCompanionCardChoices());
    } else {
      getStore().setCompanionRewardCards(null);
    }
  }

  function handleBattleVictory() {
    clearRewardTransitionTimer();
    const labyrinthRewardModifiers = getActiveRewardModifiersForContentSystem(
      run.contentSystemType,
      activeLabyrinthRewardModifiers,
    );
    const { gold, eliteBonus, bossBonus, generousBonus } = calculateVictoryGold(labyrinthRewardModifiers);
    const newGold = awardVictoryGold(gold, eliteBonus, generousBonus, bossBonus);

    applyPlayerVictoryStats();
    if (newGold > battleState.gold) playGoldGain();

    setupVictoryRewards(gold, eliteBonus, generousBonus, bossBonus, newGold, labyrinthRewardModifiers);

    setHasActiveBattle(false);
    setHoveredCardId(null);
    stopAllSfx();
    playVictory();

    rewardTransitionTimerRef.current = setTimeout(() => {
      rewardTransitionTimerRef.current = null;
      setScreen(CONSTANTS.SCREENS.REWARDS);
    }, VICTORY_TRANSITION_DELAY);
  }

  function awardVictoryGold(gold: number, eliteBonus: number, generousBonus: number, bossBonus: number) {
    const goldResult = computeVictoryGoldResult({
      battleState,
      runGold: run.runGold,
      runTrinkets: run.runTrinkets,
      gold,
      eliteBonus,
      generousBonus,
      bossBonus,
      talentGoldPerCombat: talents.talentEffects.goldPerCombat,
      goldMultiplier: getGoldMultiplier(run.characterId, run.selectedDifficulty),
    });
    run.addRunGold(goldResult.earnedBeforeMultiplier);
    return goldResult.persistedRunGold;
  }

  function getVictoryMaterials() {
    return applyMaterialFindBonus(
      getEnemyMaterialLoot(battleState.currentEnemy.id, battleState.currentEnemy.enemyType),
      homesteadEffectsRef.current,
    );
  }

  function createVictoryRewardState(
    gold: number,
    eliteBonus: number,
    generousBonus: number,
    bossBonus: number,
    newGold: number,
    materials: MaterialInventory,
  ) {
    if (battleState.currentEnemy.enemyType === CONSTANTS.ENEMY_TYPES.BOSS) {
      return createBossRewardState(gold, bossBonus, generousBonus, materials);
    }
    return createCombatRewardState(gold, eliteBonus, generousBonus, newGold, materials);
  }

  function createBossRewardState(gold: number, bossBonus: number, generousBonus: number, materials: MaterialInventory) {
    const goldMultiplier = getGoldMultiplier(run.characterId, run.selectedDifficulty);
    return createBossRewardStateFromFlow({
      gold,
      bossBonus,
      generousBonus,
      talentGoldPerCombat: talents.talentEffects.goldPerCombat,
      materials,
      trinketIds: run.runTrinkets,
      goldMultiplier,
    });
  }

  function createCombatRewardState(
    gold: number,
    eliteBonus: number,
    generousBonus: number,
    newGold: number,
    materials: MaterialInventory,
  ) {
    const goldMultiplier = getGoldMultiplier(run.characterId, run.selectedDifficulty);
    const destinations = sampleDestinationChoices(
      getAvailableDestinations({ currentHealth: battleState.playerHealth, currentGold: newGold }),
    );
    return withSelectedBossForDestinations(
      destinations,
      createCombatRewardStateFromFlow({
        battleState,
        runDeck: run.runDeck,
        gold,
        eliteBonus,
        generousBonus,
        talentGoldPerCombat: talents.talentEffects.goldPerCombat,
        materials,
        destinations,
        trinketIds: run.runTrinkets,
        goldMultiplier,
        forceTrinket: shouldForceTrinketReward(
          getActiveRewardModifiersForContentSystem(run.contentSystemType, activeLabyrinthRewardModifiers),
        ),
      }),
    );
  }

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
    if (systemType === CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN) {
      const hasCompletedNovice = (completedDifficulties[selectedId] ?? []).includes(DEFAULT_CAMPAIGN_DIFFICULTY_ID);
      if (!hasCompletedNovice) {
        const { freshDeck, totalStartGold } = initializeRunForDifficulty(selectedId, DEFAULT_CAMPAIGN_DIFFICULTY_ID);
        const modifiers = getDifficultyModifiers(selectedId, DEFAULT_CAMPAIGN_DIFFICULTY_ID);
        onStartBattle(freshDeck, totalStartGold, DEFAULT_BATTLE_ENEMY_TYPE, modifiers);
        navigateTo(CONSTANTS.SCREENS.BATTLE);
      } else {
        getStore().setPendingCharacterId(selectedId);
        navigateTo(CONSTANTS.SCREENS.DIFFICULTY_SELECT);
      }
    } else if (systemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
      initializeLabyrinthRun(selectedId);
    } else if (systemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
      initializeWildwoodRun(selectedId);
    }
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
    return createRunStartSnapshot({
      characterId,
      contentSystemType,
      difficultyId,
      talentStartGold: talents.talentEffects.startGold,
      homesteadStartGold: homesteadEffectsRef.current.startGold,
      homesteadStartMaxHealthBonus: homesteadEffectsRef.current.startMaxHealthBonus,
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
    if (route === CONSTANTS.REWARD_ROUTES.COMPANION_REWARD) {
      getStore().setRewardState(nextRewardState);
      if (clearCompanionRewardCards) getStore().setCompanionRewardCards(null);
      navigateTo(CONSTANTS.SCREENS.REWARDS);
      return;
    }

    if (isRunVictoryRewardRoute(route)) {
      completeRunVictory(materials, () => getStore().setRewardState(nextRewardState));
      return;
    }

    if (route === CONSTANTS.REWARD_ROUTES.LABYRINTH_MAP) {
      onLabyrinthClearNode();
      navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP, () => getStore().setRewardState(nextRewardState));
      return;
    }

    if (route === CONSTANTS.REWARD_ROUTES.ACT_COMPLETE) {
      handleActComplete(materials);
      return;
    }

    navigateTo(CONSTANTS.SCREENS.DESTINATION, () => getStore().setRewardState(nextRewardState));
  }

  function finishRewards() {
    const result = finalizeRewardState({
      rewardState,
      companionRewardCards,
      contentSystemType: run.contentSystemType,
      currentEnemyType,
      grantAlchemistReward: shouldGrantAlchemistReward(
        getActiveRewardModifiersForContentSystem(run.contentSystemType, activeLabyrinthRewardModifiers),
      ),
    });

    onAddMaterialsRef.current(result.materials);
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
      if (run.selectedDifficulty) onMarkDifficultyCompleted(run.characterId, run.selectedDifficulty);
      completeRunVictory(displayMaterials);
    } else {
      run.setCurrentAct((p) => p + 1);
      run.setDestinationIndexInAct(0);
      run.setCompletedDestinations([]);
      getStore().setRewardState(
        createDestinationRewardState(sampleDestinationChoices(getAvailableDestinations({ destinationIndexInAct: 0 }))),
      );
      navigateTo(CONSTANTS.SCREENS.DESTINATION);
    }
  }

  function awardRunEndMaterials(displayMaterials: MaterialInventory | null = null) {
    const baseHerbs = homesteadEffectsRef.current.herbFindBonus > 0 ? run.roomsEncountered : 0;
    const food = homesteadEffectsRef.current.companionDamage > 0 ? run.roomsEncountered : 0;
    const mats = applyMaterialFindBonus(
      { wood: 0, iron: 0, herbs: baseHerbs, food, crystal: 0 },
      homesteadEffectsRef.current,
    );
    if (mats.herbs > 0 || food > 0) onAddMaterialsRef.current(mats);
    getStore().setRunEndMaterials(displayMaterials ? addInventory(displayMaterials, mats) : mats);
    return mats;
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
    destinationButtonRefs,
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
