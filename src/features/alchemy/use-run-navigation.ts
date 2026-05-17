// Run-flow controller for routing, rewards, mysteries, campfires, act transitions, and reset.
// Depends on battle/run/talent/shop callbacks, homestead effects, game data, and audio feedback.
// Used by the top-level alchemy controller to keep screen changes and run mutations synchronized.
import { useEffect, useMemo, useRef, useState } from "react";
import { createBattleState, isPlayerDefeated } from "@/lib/battle";
import { getDifficultyModifiers, getGoldMultiplier, getStartingDeck, type BattleCard, type CharacterId, type DifficultyId, type DifficultyModifier } from "@/lib/game-data";
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
  type RewardState,
} from "./navigation/reward-flow";
import { useMysteryFlow } from "./navigation/use-mystery-flow";
import { routeDestinationChoice } from "./navigation/routing-flow";
import { createActiveRunData } from "./run/active-run-data";
import { createRunStartSnapshot, type RunStartSnapshot } from "./run/run-start";
import { corruptDeckCard, type CorruptionResult } from "./corruption";
import type { ContentSystemId, LabyrinthMap, LabyrinthModifierKind } from "@/lib/content-systems/types";

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
  setHasActiveRun,
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
  navigateTo: (nextScreen: Screen) => void;
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
  onStartBattle: (deck?: BattleCard[], gold?: number, enemyType?: "normal" | "elite", modifiers?: DifficultyModifier[]) => void;
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
  // Run-flow side effects live here because screens, rewards, destination routing,
  // mystery outcomes, act completion, and reset all need the same run/battle snapshot.
  const [rewardState, setRewardState] = useState<RewardState>(() => createEmptyRewardState());
  const [companionRewardCards, setCompanionRewardCards] = useState<BattleCard[] | null>(null);
  const [runEndMaterials, setRunEndMaterials] = useState<MaterialInventory>({
    wood: 0,
    iron: 0,
    herbs: 0,
    food: 0,
    crystal: 0,
  });
  const [corruptionResult, setCorruptionResult] = useState<CorruptionResult | null>(null);
  const [pendingCharacterId, setPendingCharacterId] = useState<CharacterId | null>(null);
  const [pendingContentSystemType, setPendingContentSystemType] = useState<ContentSystemId>(run.contentSystemType);

  const destinationButtonRefs = useRef<Partial<Record<Destination, HTMLButtonElement | null>>>({});

  const mystery = useMysteryFlow({
    runMaxHealth: run.runMaxHealth,
    setRunDeck: run.setRunDeck,
    setRunGold: run.setRunGold,
    setRunPlayerHealth: run.setRunPlayerHealth,
    setRunTrinkets: run.setRunTrinkets,
    setDiscoveredCardIds,
    setDiscoveredTrinketIds,
    awardMysteryXP: talents.awardMysteryXP,
    onAddMaterials: (materials) => onAddMaterialsRef.current(applyMaterialFindBonus(materials, homesteadEffectsRef.current)),
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

  function getAvailableDestinations(currentHp?: number, currentGold?: number, destIdxInAct?: number, maxHp?: number): Destination[] {
    const destinationIndexInAct = destIdxInAct ?? run.destinationIndexInAct;
    const previousDestination = destinationIndexInAct === 0 ? undefined : run.completedDestinations[run.completedDestinations.length - 1];
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
  useEffect(() => { handleBattleDefeatRef.current = handleBattleDefeat; });
  useEffect(() => { handleBattleVictoryRef.current = handleBattleVictory; });

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
    // Victory state is captured in one sequence so persisted HP, gold/material rewards,
    // reward choices, battle cleanup, audio, and delayed routing agree on the same result.
    const labyrinthRewardModifiers = getActiveRewardModifiersForContentSystem(run.contentSystemType, activeLabyrinthRewardModifiers);
    const baseGold = randomBetween(GOLD_REWARD_MIN, GOLD_REWARD_MAX);
    let gold = Math.floor(baseGold * (1 + talents.talentEffects.enemyGoldDropBonus));

    if (talents.talentEffects.companionGoldFindActive && battleState.activeCompanion && Math.random() < COMPANION_GOLD_FIND_CHANCE) {
      gold = Math.floor(gold * COMPANION_GOLD_MULTIPLIER);
    }

    const eliteBonus =
      battleState.currentEnemy.enemyType === "elite" ? Math.floor(gold * ELITE_GOLD_BONUS_FRACTION) : 0;
    const bossBonus = battleState.currentEnemy.enemyType === "boss" ? Math.floor(gold * BOSS_GOLD_BONUS_FRACTION) : 0;
    const generousBonus = getGenerousGoldBonus(labyrinthRewardModifiers, gold);
    const newGold = awardVictoryGold(gold, eliteBonus, generousBonus, bossBonus);
    run.setRunPlayerHealth(battleState.playerHealth);
    if (newGold > battleState.gold) playGoldGain();
    if (talents.talentEffects.maxHealthPerCombat > 0) {
      run.setRunMaxHealth((p) => p + talents.talentEffects.maxHealthPerCombat);
    }
    const materials = applyLabyrinthRewardMaterialModifiers(getVictoryMaterials(), labyrinthRewardModifiers);
    setRewardState(createVictoryRewardState(gold, eliteBonus, generousBonus, bossBonus, newGold, materials));
    if (shouldGrantCompanionReward(labyrinthRewardModifiers)) {
      setCompanionRewardCards(getCompanionCardChoices());
    } else {
      setCompanionRewardCards(null);
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
    return applyMaterialFindBonus(getEnemyMaterialLoot(battleState.currentEnemy.id, battleState.currentEnemy.enemyType), homesteadEffectsRef.current);
  }

  function createVictoryRewardState(
    gold: number,
    eliteBonus: number,
    generousBonus: number,
    bossBonus: number,
    newGold: number,
    materials: MaterialInventory,
  ) {
    // Boss rewards branch here because bosses advance acts and always offer trinkets,
    // while normal/elite fights continue the destination route with card/trinket rolls.
    if (battleState.currentEnemy.enemyType === "boss") {
      return createBossRewardState(gold, bossBonus, materials);
    }
    return createCombatRewardState(gold, eliteBonus, generousBonus, newGold, materials);
  }

  function createBossRewardState(gold: number, bossBonus: number, materials: MaterialInventory) {
    const goldMultiplier = getGoldMultiplier(run.characterId, run.selectedDifficulty);
    return createBossRewardStateFromFlow({
      gold,
      bossBonus,
      talentGoldPerCombat: talents.talentEffects.goldPerCombat,
      materials,
      trinketIds: run.runTrinkets,
      goldMultiplier,
    });
  }

  function createCombatRewardState(gold: number, eliteBonus: number, generousBonus: number, newGold: number, materials: MaterialInventory) {
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
      forceTrinket: shouldForceTrinketReward(getActiveRewardModifiersForContentSystem(run.contentSystemType, activeLabyrinthRewardModifiers)),
    });
  }

  // ============ Content System Flow ============

  function beginCampaign() {
    // Campaign resume logic checks for existing campaign-type active run.
    if (hasActiveBattle && run.contentSystemType === "campaign") {
      returnToBattle();
      return;
    }
    if (hasActiveRun && run.contentSystemType === "campaign") {
      setRewardState((prev) => ({
        ...prev,
        destinations:
          prev.destinations.length > 0 ? prev.destinations : sampleDestinationChoices(getAvailableDestinations()),
      }));
      navigateTo("destination");
      return;
    }
    setPendingContentSystemType("campaign");
    navigateTo("character-select");
  }

  function beginLabyrinth() {
    // Labyrinth resume logic checks for existing labyrinth-type active run.
    if (hasActiveBattle && run.contentSystemType === "labyrinth") {
      returnToBattle();
      return;
    }
    if (hasActiveRun && run.contentSystemType === "labyrinth") {
      navigateTo("labyrinth-map");
      return;
    }
    setPendingContentSystemType("labyrinth");
    navigateTo("character-select");
  }

  function beginWildwood() {
    // Wildwood has no run state to resume — always starts fresh.
    setPendingContentSystemType("wildwood");
    navigateTo("character-select");
  }

  function handleCharacterSelect(selectedId: CharacterId) {
    const systemType = pendingContentSystemType;

    if (systemType === "campaign") {
      // Existing campaign flow: Novice auto-starts, otherwise show difficulty select.
      const hasCompletedNovice = (completedDifficulties[selectedId] ?? []).includes("difficulty-1");
      if (!hasCompletedNovice) {
        const { freshDeck, totalStartGold } = initializeRunForDifficulty(selectedId, "difficulty-1");
        const modifiers = getDifficultyModifiers(selectedId, "difficulty-1");
        onStartBattle(freshDeck, totalStartGold, "normal", modifiers);
        navigateTo("battle");
      } else {
        setPendingCharacterId(selectedId);
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
    setDiscoveredCardIds((current) => appendUniqueMany(current, snapshot.freshDeck.map((c) => c.id)));
    setHoveredCardId(null);
    navigateTo("labyrinth-map");
  }

  function initializeWildwoodRun(characterId: CharacterId) {
    const snapshot = createStartSnapshot(characterId, "wildwood");
    applyRunStartSnapshot(snapshot);
    setHoveredCardId(null);
    navigateTo("wildwood-select");
  }

  function handleWildwoodBossSelect(bossId: string) {
    if (!onStartBossById(bossId)) return;
    setHoveredCardId(null);
    setHasActiveBattle(true);
    navigateTo("battle");
  }

  function initializeRunForDifficulty(characterId: CharacterId, difficultyId: DifficultyId) {
    const snapshot = createStartSnapshot(characterId, "campaign", difficultyId);
    applyRunStartSnapshot(snapshot);
    if (snapshot.runGold > 0) playGoldGain();
    setRewardState(createEmptyRewardState(sampleDestinationChoices(getAvailableDestinations(snapshot.runMaxHealth, snapshot.runGold, 0, snapshot.runMaxHealth))));
    setDiscoveredCardIds((current) =>
      appendUniqueMany(current, snapshot.freshDeck.map((c) => c.id)),
    );
    setEncounteredEnemyIds([]);
    setHoveredCardId(null);
    return { freshDeck: snapshot.freshDeck, totalStartGold: snapshot.runGold };
  }

  function createStartSnapshot(characterId: CharacterId, contentSystemType: ContentSystemId, difficultyId?: DifficultyId | null) {
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
    setHasActiveRun(snapshot.hasActiveRun);
  }

  function handleDifficultySelect(difficultyId: DifficultyId) {
    if (!pendingCharacterId) return;
    const selectedId = pendingCharacterId;
    setPendingCharacterId(null);
    const { freshDeck, totalStartGold } = initializeRunForDifficulty(selectedId, difficultyId);
    const modifiers = getDifficultyModifiers(selectedId, difficultyId);
    onStartBattle(freshDeck, totalStartGold, "normal", modifiers);
    navigateTo("battle");
  }

  function handleBackFromDifficultySelect() {
    setPendingCharacterId(null);
    navigateTo("character-select");
  }

  function returnToBattle() {
    if (hasActiveBattle) {
      navigateTo("battle");
    }
  }
  function goToScreen(nextScreen: Screen) {
    setHoveredCardId(null);
    navigateTo(nextScreen);
  }

  // ============ Rewards & Destinations ============

  function finishRewards() {
    // Apply materials/card/trinket rewards before routing so the next screen sees the
    // updated deck and collection; boss rewards then diverge into act completion.
    const result = finalizeRewardState({
      rewardState,
      companionRewardCards,
      contentSystemType: run.contentSystemType,
      currentEnemyType,
      grantAlchemistReward: shouldGrantAlchemistReward(getActiveRewardModifiersForContentSystem(run.contentSystemType, activeLabyrinthRewardModifiers)),
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

    // Alchemist reward modifier: add a random potion card alongside the chosen reward.
    if (result.grantAlchemistReward) {
      const potion = getRandomPotionCard();
      run.setRunDeck((prev) => [...prev, potion]);
      setDiscoveredCardIds((cur) => appendUnique(cur, potion.id));
    }

    setRewardState(result.nextRewardState);
    setHoveredCardId(null);

    // Companion reward modifier: show second reward step with companion card choices.
    if (result.route === "companion-reward") {
      if (result.clearCompanionRewardCards) setCompanionRewardCards(null);
      setHoveredCardId(null);
      navigateTo("rewards");
      return;
    }

    if (result.route === "labyrinth-victory") {
      awardRunEndMaterials(result.materials);
      setHasActiveBattle(false);
      setHasActiveRun(false);
      navigateTo("run-victory");
      return;
    }

    if (result.route === "labyrinth-map") {
      onLabyrinthClearNode();
      navigateTo("labyrinth-map");
      return;
    }

    if (result.route === "act-complete") {
      handleActComplete();
      return;
    }

    navigateTo("destination");
  }

  function handleDestinationChoice(destination: Destination) {
    // Route progress is recorded before dispatching so battle scaling and later boss-slot
    // checks reflect the chosen node even if the destination immediately starts combat.
    run.setCompletedDestinations((prev) => [...prev, destination]);
    run.setDestinationIndexInAct((p) => p + 1);

    setHoveredCardId(null);
    routeDestinationChoice(destination, {
      navigateTo,
      beginMysteryEvent,
      resetCorruption: () => setCorruptionResult(null),
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
    setHasActiveRun(false);
    setHoveredCardId(null);
    setScreen("game-over");
  }

  function handleActComplete() {
    // Farm yield is a full-run reward, not an act reward. Non-final acts reset only the
    // in-act destination route while preserving deck, gold, HP, and trinkets.
    setHoveredCardId(null);
    setHasActiveBattle(false);

    if (run.currentAct >= ACTS_PER_RUN) {
      awardRunEndMaterials();
      if (run.selectedDifficulty) {
        onMarkDifficultyCompleted(run.characterId, run.selectedDifficulty);
      }
      navigateTo("run-victory");
    } else {
      run.setCurrentAct((p) => p + 1);
      run.setDestinationIndexInAct(0);
      run.setCompletedDestinations([]);
      setRewardState((prev) => ({
        ...prev,
        destinations: sampleDestinationChoices(getAvailableDestinations(undefined, undefined, 0)),
      }));
      navigateTo("destination");
    }
  }

  function awardRunEndMaterials(displayMaterials: MaterialInventory | null = null) {
    const baseHerbs = homesteadEffectsRef.current.herbFindBonus > 0 ? run.roomsEncountered : 0;
    const food = homesteadEffectsRef.current.companionDamage > 0 ? run.roomsEncountered : 0;
    const mats = applyMaterialFindBonus({ wood: 0, iron: 0, herbs: baseHerbs, food, crystal: 0 }, homesteadEffectsRef.current);
    const herbs = mats.herbs;
    if (herbs > 0 || food > 0) onAddMaterialsRef.current(mats);
    setRunEndMaterials(displayMaterials ? addInventory(displayMaterials, mats) : mats);
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
    setRewardState((prev) => ({ ...prev, destinations: sampleDestinationChoices(getAvailableDestinations()) }));
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
    // The altar replaces the selected run-deck slot immediately so later battles and saves
    // see the altered card object, then the screen reveals exactly what changed.
    const { deck, result } = corruptDeckCard(run.runDeck, cardIndex);
    run.setRunDeck(deck);
    setCorruptionResult(result);
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
    // Reset must clear combat animation state, battle/run/talent session state, reward
    // and mystery UI, active flags, and routing together to avoid resuming stale runs.
    clearCardGhosts();
    setBattleState(createBattleState(getStartingDeck(run.characterId), 0));
    run.reset();
    talents.resetRunXP();
    setPendingContentSystemType("campaign");
    setRewardState(createEmptyRewardState());
    mystery.clearCardChoices();
    setHoveredCardId(null);
    setHasActiveBattle(false);
    setHasActiveRun(false);
    navigateTo("menu");
  }

  return {
    screen,
    setScreen,
    rewardState,
    setRewardState,
    setSelectedRewardId: (id: string | null) => setRewardState((p) => ({ ...p, selectedId: id })),
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
