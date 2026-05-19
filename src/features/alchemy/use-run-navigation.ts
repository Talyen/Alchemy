// Run-flow controller for routing, rewards, mysteries, campfires, act transitions, and reset.
// Uses useScreenStore (Zustand) for navigation state instead of local useState.
import { useEffect, useMemo, useRef } from "react";
import { createBattleState, isPlayerDefeated } from "@/lib/battle";
import {
  getDifficultyModifiers,
  getGoldMultiplier,
  getStartingDeck,
  type BattleCard,
  type CharacterId,
  type DifficultyId,
  type DifficultyModifier,
} from "@/lib/game-data";
import { playVictory, playDefeat, playGoldGain } from "@/lib/audio";
import { appendUnique, appendUniqueMany } from "@/lib/utils";
import type { Destination, Screen } from "./types";
import { applyMaterialFindBonus, getEnemyMaterialLoot } from "@/lib/homestead/loot";
import { addInventory } from "@/lib/homestead/inventory";
import { type HomesteadEffectManifest, type MaterialInventory } from "@/lib/homestead/types";
import {
  ACTS_PER_RUN,
  CAMPFIRE_HEAL_FRACTION,
  COMPANION_GOLD_FIND_CHANCE,
  COMPANION_GOLD_MULTIPLIER,
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
} from "./navigation/reward-flow";
import { useMysteryFlow } from "./navigation/use-mystery-flow";
import { routeDestinationChoice } from "./navigation/routing-flow";
import { createActiveRunData } from "./run/active-run-data";
import { createRunStartSnapshot, type RunStartSnapshot } from "./run/run-start";
import { corruptDeckCard } from "./corruption";
import type { ContentSystemId, LabyrinthMap, LabyrinthModifierKind } from "@/lib/content-systems/types";
import { useScreenStore } from "./stores/screen-store";

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
  setHasActiveRun: _setHasActiveRun,
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
  onStartBossById: _onStartBossById,
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
  setHasActiveRun: React.Dispatch<React.SetStateAction<boolean>>;
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

  function getAvailableDestinations(
    currentHp?: number,
    currentGold?: number,
    destIdxInAct?: number,
    maxHp?: number,
  ): Destination[] {
    const destinationIndexInAct = destIdxInAct ?? run.destinationIndexInAct;
    const previousDestination =
      destinationIndexInAct === 0 ? undefined : run.completedDestinations[run.completedDestinations.length - 1];
    return getRunAvailableDestinations({
      destinationIndexInAct,
      currentHp: currentHp ?? run.runPlayerHealth,
      currentGold: currentGold ?? run.runGold,
      maxHp: maxHp ?? run.runMaxHealth,
      previousDestination,
    });
  }

  // ============ Victory / Defeat Effects ============

  const handleBattleDefeatRef = useRef(handleBattleDefeat);
  const handleBattleVictoryRef = useRef(handleBattleVictory);
  useEffect(() => {
    handleBattleDefeatRef.current = handleBattleDefeat;
  });
  useEffect(() => {
    handleBattleVictoryRef.current = handleBattleVictory;
  });

  useEffect(() => {
    if (screen !== "battle" || !isPlayerDefeated(battleState)) return;
    handleBattleDefeatRef.current();
  }, [battleState, screen]);

  useEffect(() => {
    if (screen === "battle" && hasActiveBattle && battleState.enemyHealth > 0) battleVictoryHandledRef.current = false;
  }, [battleState.enemyHealth, hasActiveBattle, screen]);

  useEffect(() => {
    if (screen !== "battle" || !hasActiveBattle || battleState.enemyHealth > 0) return;
    if (isPlayerDefeated(battleState)) return;
    if (battleVictoryHandledRef.current) return;
    battleVictoryHandledRef.current = true;
    handleBattleVictoryRef.current();
  }, [battleState, hasActiveBattle, screen]);

  function handleBattleDefeat() {
    if (run.contentSystemType === "labyrinth") {
      onLabyrinthFailNode();
      setHasActiveBattle(false);
      setHoveredCardId(null);
      navigateTo("labyrinth-map");
      return;
    }
    awardRunEndMaterials();
    playDefeat();
    setHasActiveBattle(false);
    setHoveredCardId(null);
    setScreen("game-over");
  }

  function handleBattleVictory() {
    const labyrinthRewardModifiers = getActiveRewardModifiersForContentSystem(
      run.contentSystemType,
      activeLabyrinthRewardModifiers,
    );
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
      (battleState.currentEnemy.enemyType === "elite" ? talents.talentEffects.eliteGoldDropBonus : 0);
    const eliteBonus = battleState.currentEnemy.enemyType === "elite" ? Math.floor(gold * eliteFraction) : 0;
    const bossBonus = battleState.currentEnemy.enemyType === "boss" ? Math.floor(gold * BOSS_GOLD_BONUS_FRACTION) : 0;
    const generousBonus = getGenerousGoldBonus(labyrinthRewardModifiers, gold);
    const newGold = awardVictoryGold(gold, eliteBonus, generousBonus, bossBonus);
    run.setRunPlayerHealth(battleState.playerHealth);
    if (newGold > battleState.gold) playGoldGain();
    if (talents.talentEffects.maxHealthPerCombat > 0) {
      run.setRunMaxHealth((p) => p + talents.talentEffects.maxHealthPerCombat);
    }
    const materials = applyLabyrinthRewardMaterialModifiers(getVictoryMaterials(), labyrinthRewardModifiers);
    getStore().setRewardState(createVictoryRewardState(gold, eliteBonus, generousBonus, bossBonus, newGold, materials));
    if (shouldGrantCompanionReward(labyrinthRewardModifiers)) {
      getStore().setCompanionRewardCards(getCompanionCardChoices());
    } else {
      getStore().setCompanionRewardCards(null);
    }
    setHasActiveBattle(false);
    setHoveredCardId(null);
    playVictory();
    return setTimeout(() => setScreen("rewards"), VICTORY_TRANSITION_DELAY);
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
    if (battleState.currentEnemy.enemyType === "boss") {
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
    return createCombatRewardStateFromFlow({
      battleState,
      runDeck: run.runDeck,
      gold,
      eliteBonus,
      generousBonus,
      talentGoldPerCombat: talents.talentEffects.goldPerCombat,
      materials,
      destinations: sampleDestinationChoices(getAvailableDestinations(battleState.playerHealth, newGold)),
      trinketIds: run.runTrinkets,
      goldMultiplier,
      forceTrinket: shouldForceTrinketReward(
        getActiveRewardModifiersForContentSystem(run.contentSystemType, activeLabyrinthRewardModifiers),
      ),
    });
  }

  // ============ Content System Flow ============

  function beginCampaign() {
    if (hasActiveBattle && run.contentSystemType === "campaign") {
      returnToBattle();
      return;
    }
    if (hasActiveRun && run.contentSystemType === "campaign") {
      getStore().setRewardState((prev) => ({
        ...prev,
        destinations:
          prev.destinations.length > 0 ? prev.destinations : sampleDestinationChoices(getAvailableDestinations()),
      }));
      navigateTo("destination");
      return;
    }
    getStore().setPendingContentSystemType("campaign");
    navigateTo("character-select");
  }

  function beginLabyrinth() {
    if (hasActiveBattle && run.contentSystemType === "labyrinth") {
      returnToBattle();
      return;
    }
    if (hasActiveRun && run.contentSystemType === "labyrinth") {
      navigateTo("labyrinth-map");
      return;
    }
    getStore().setPendingContentSystemType("labyrinth");
    navigateTo("character-select");
  }

  function beginWildwood() {
    getStore().setPendingContentSystemType("wildwood");
    navigateTo("character-select");
  }

  function handleCharacterSelect(selectedId: CharacterId) {
    const systemType = pendingContentSystemType;
    if (systemType === "campaign") {
      const hasCompletedNovice = (completedDifficulties[selectedId] ?? []).includes("difficulty-1");
      if (!hasCompletedNovice) {
        const { freshDeck, totalStartGold } = initializeRunForDifficulty(selectedId, "difficulty-1");
        const modifiers = getDifficultyModifiers(selectedId, "difficulty-1");
        onStartBattle(freshDeck, totalStartGold, "normal", modifiers);
        navigateTo("battle");
      } else {
        getStore().setPendingCharacterId(selectedId);
        navigateTo("difficulty-select");
      }
    } else if (systemType === "labyrinth") {
      initializeLabyrinthRun(selectedId);
    } else if (systemType === "wildwood") {
      initializeWildwoodRun(selectedId);
    }
  }

  function initializeLabyrinthRun(characterId: CharacterId) {
    const snapshot = createStartSnapshot(characterId, "labyrinth");
    applyRunStartSnapshot(snapshot);
    if (snapshot.runGold > 0) playGoldGain();
    setDiscoveredCardIds((current) =>
      appendUniqueMany(
        current,
        snapshot.freshDeck.map((c) => c.id),
      ),
    );
    setHoveredCardId(null);
    navigateTo("labyrinth-map");
  }

  function initializeWildwoodRun(characterId: CharacterId) {
    const snapshot = createStartSnapshot(characterId, "wildwood");
    applyRunStartSnapshot(snapshot);
    setHoveredCardId(null);
    navigateTo("wildwood-select");
  }

  function initializeRunForDifficulty(characterId: CharacterId, difficultyId: DifficultyId) {
    const snapshot = createStartSnapshot(characterId, "campaign", difficultyId);
    applyRunStartSnapshot(snapshot);
    if (snapshot.runGold > 0) playGoldGain();
    getStore().setRewardState(
      createEmptyRewardState(
        sampleDestinationChoices(
          getAvailableDestinations(snapshot.runMaxHealth, snapshot.runGold, 0, snapshot.runMaxHealth),
        ),
      ),
    );
    setDiscoveredCardIds((current) =>
      appendUniqueMany(
        current,
        snapshot.freshDeck.map((c) => c.id),
      ),
    );
    setEncounteredEnemyIds([]);
    setHoveredCardId(null);
    return { freshDeck: snapshot.freshDeck, totalStartGold: snapshot.runGold };
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
    onStartBattle(freshDeck, totalStartGold, "normal", modifiers);
    navigateTo("battle", () => getStore().setPendingCharacterId(null));
  }

  function handleBackFromDifficultySelect() {
    navigateTo("character-select");
  }

  function returnToBattle() {
    if (hasActiveBattle) navigateTo("battle");
  }

  function handleWildwoodBossSelect(bossId: string) {
    if (!_onStartBossById(bossId)) return;
    setHoveredCardId(null);
    setHasActiveBattle(true);
    navigateTo("battle");
  }

  function goToScreen(nextScreen: Screen) {
    setHoveredCardId(null);
    navigateTo(nextScreen);
  }

  // ============ Rewards & Destinations ============

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
    if (result.selectedChoice) {
      const selectedId = result.selectedChoice.id;
      if (result.selectedRewardType === "card") {
        run.setRunDeck((prev) => [...prev, result.selectedChoice as BattleCard]);
        setDiscoveredCardIds((cur) => appendUnique(cur, selectedId));
      } else {
        run.setRunTrinkets((prev) => [...prev, selectedId]);
        setDiscoveredTrinketIds((cur) => appendUnique(cur, selectedId));
      }
    }

    setHoveredCardId(null);

    if (result.route === "companion-reward") {
      getStore().setRewardState(result.nextRewardState);
      if (result.clearCompanionRewardCards) getStore().setCompanionRewardCards(null);
      navigateTo("rewards");
      return;
    }

    if (result.grantAlchemistReward) {
      const potion = getRandomPotionCard();
      run.setRunDeck((prev) => [...prev, potion]);
      setDiscoveredCardIds((cur) => appendUnique(cur, potion.id));
    }

    if (result.route === "labyrinth-victory") {
      awardRunEndMaterials(result.materials);
      setHasActiveBattle(false);
      getStore().setHasActiveRun(false);
      navigateTo("run-victory", () => getStore().setRewardState(result.nextRewardState));
      return;
    }

    if (result.route === "wildwood-victory") {
      awardRunEndMaterials(result.materials);
      setHasActiveBattle(false);
      getStore().setHasActiveRun(false);
      navigateTo("run-victory", () => getStore().setRewardState(result.nextRewardState));
      return;
    }

    if (result.route === "labyrinth-map") {
      onLabyrinthClearNode();
      navigateTo("labyrinth-map", () => getStore().setRewardState(result.nextRewardState));
      return;
    }

    if (result.route === "act-complete") {
      getStore().setRewardState(result.nextRewardState);
      handleActComplete(result.materials);
      return;
    }

    navigateTo("destination", () => getStore().setRewardState(result.nextRewardState));
  }

  function handleDestinationChoice(destination: Destination) {
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
      startBossBattle: onStartBossBattle,
    });
  }

  function beginMysteryEvent() {
    mystery.beginMysteryEvent(() => navigateTo("mystery"));
  }

  function endLabyrinthRun() {
    if (run.contentSystemType !== "labyrinth") return;
    awardRunEndMaterials();
    playDefeat();
    setHasActiveBattle(false);
    getStore().setHasActiveRun(false);
    setHoveredCardId(null);
    setScreen("game-over");
  }

  function handleActComplete(displayMaterials?: MaterialInventory) {
    setHoveredCardId(null);
    setHasActiveBattle(false);

    if (run.currentAct >= ACTS_PER_RUN) {
      awardRunEndMaterials(displayMaterials);
      if (run.selectedDifficulty) onMarkDifficultyCompleted(run.characterId, run.selectedDifficulty);
      navigateTo("run-victory");
    } else {
      run.setCurrentAct((p) => p + 1);
      run.setDestinationIndexInAct(0);
      run.setCompletedDestinations([]);
      getStore().setRewardState((prev) => ({
        ...prev,
        destinations: sampleDestinationChoices(getAvailableDestinations(undefined, undefined, 0)),
      }));
      navigateTo("destination");
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

  function advanceToNextDestination() {
    run.setRoomsEncountered((p) => p + 1);
    if (run.contentSystemType === "labyrinth") {
      onLabyrinthClearNode();
      setHoveredCardId(null);
      navigateTo("labyrinth-map");
      return;
    }
    getStore().setRewardState((prev) => ({
      ...prev,
      destinations: sampleDestinationChoices(getAvailableDestinations()),
    }));
    setHoveredCardId(null);
    mystery.clearCardChoices();
    navigateTo("destination");
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
    clearCardGhosts();
    setHoveredCardId(null);
    setHasActiveBattle(false);
    navigateTo("menu", () => {
      setBattleState(createBattleState(getStartingDeck(run.characterId), 0));
      run.reset();
      talents.resetRunXP();
      getStore().setPendingContentSystemType("campaign");
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
