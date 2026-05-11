// Run-flow controller for routing, rewards, mysteries, campfires, act transitions, and reset.
// Depends on battle/run/talent/shop callbacks, homestead effects, game data, and audio feedback.
// Used by the top-level alchemy controller to keep screen changes and run mutations synchronized.
import { useEffect, useMemo, useRef, useState } from "react";
import { createBattleState, maxPlayerHealth } from "@/lib/battle";
import { cardLibrary, characters, starterDeck, type BattleCard, type CharacterId } from "@/lib/game-data";
import { playVictory, playDefeat, playGoldGain } from "@/lib/audio";
import { appendUnique, appendUniqueMany, pickRandom } from "@/lib/utils";
import type { Destination, Screen } from "./types";
import { getEnemyMaterialLoot } from "@/lib/homestead/loot";
import { type HomesteadEffectManifest, type MaterialInventory } from "@/lib/homestead/types";
import { mysteryPool, type MysteryChoice, type MysteryEvent } from "./mystery-events";
import {
  ACTS_PER_RUN, CAMPFIRE_HEAL_FRACTION,
  ELITE_GOLD_BONUS_FRACTION, BOSS_GOLD_BONUS_FRACTION, GOLD_REWARD_MAX,
  GOLD_REWARD_MIN, VICTORY_TRANSITION_DELAY,
} from "@/lib/game-constants";
import { randomBetween } from "./utils";
import type { BattleState } from "@/lib/battle";
import type { useRunState } from "./use-run-state";
import type { useTalentState } from "./use-talent-state";
import { getRunAvailableDestinations, sampleDestinationChoices } from "./navigation/destination-flow";
import { createBossRewardState as createBossRewardStateFromFlow, createCombatRewardState as createCombatRewardStateFromFlow, createEmptyRewardState, getVictoryGoldTotal, type RewardState } from "./navigation/reward-flow";
import { addCardToRun, applyMysteryEffect } from "./navigation/mystery-flow";

export function useRunNavigation({
  run, talents,
  screen, setScreen, navigateTo,
  battleState, hasActiveBattle, setHasActiveBattle,
  hasActiveRun, setHasActiveRun,
  battleStateRef,
  clearCardGhosts, setBattleState,
  setDiscoveredCardIds,
  setEncounteredEnemyIds, setDiscoveredTrinketIds,
  onAddMaterialsRef, onTriggerFarmYieldRef, homesteadEffectsRef,
  setHoveredCardId,
  onStartBattle, onStartBossBattle,
  onInitShop, onInitAlchemist,
}: {
  run: ReturnType<typeof useRunState>;
  talents: ReturnType<typeof useTalentState>;
  screen: Screen;
  setScreen: React.Dispatch<React.SetStateAction<Screen>>;
  navigateTo: (nextScreen: Screen) => void;
  battleState: BattleState;
  hasActiveBattle: boolean;
  setHasActiveBattle: React.Dispatch<React.SetStateAction<boolean>>;
  hasActiveRun: boolean;
  setHasActiveRun: React.Dispatch<React.SetStateAction<boolean>>;
  battleStateRef: React.MutableRefObject<BattleState>;
  clearCardGhosts: () => void;
  setBattleState: React.Dispatch<React.SetStateAction<BattleState>>;
  setDiscoveredCardIds: React.Dispatch<React.SetStateAction<string[]>>;
  setEncounteredEnemyIds: React.Dispatch<React.SetStateAction<string[]>>;
  setDiscoveredTrinketIds: React.Dispatch<React.SetStateAction<string[]>>;
  onAddMaterialsRef: React.MutableRefObject<(materials: MaterialInventory) => void>;
  onTriggerFarmYieldRef: React.MutableRefObject<() => void>;
  homesteadEffectsRef: React.MutableRefObject<HomesteadEffectManifest>;
  setHoveredCardId: React.Dispatch<React.SetStateAction<string | null>>;
  onStartBattle: (deck?: BattleCard[], gold?: number, enemyType?: "normal" | "elite") => void;
  onStartBossBattle: () => void;
  onInitShop: () => void;
  onInitAlchemist: () => void;
}) {
  // Run-flow side effects live here because screens, rewards, destination routing,
  // mystery outcomes, act completion, and reset all need the same run/battle snapshot.
  const [rewardState, setRewardState] = useState<RewardState>(() => createEmptyRewardState());
  const [mysteryEvent, setMysteryEvent] = useState<MysteryEvent | null>(null);
  const [mysteryCardChoices, setMysteryCardChoices] = useState<BattleCard[] | null>(null);

  const destinationButtonRefs = useRef<Partial<Record<Destination, HTMLButtonElement | null>>>({});

  const currentActiveRunData = useMemo(() => ({
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
  }), [run.characterId, run.runDeck, run.runGold, run.runPlayerHealth, run.runMaxHealth, run.roomsEncountered, run.currentAct, run.destinationIndexInAct, run.completedDestinations, run.runTrinkets]);

  function getAvailableDestinations(currentHp?: number, currentGold?: number, destIdxInAct?: number): Destination[] {
    return getRunAvailableDestinations({
      destinationIndexInAct: destIdxInAct ?? run.destinationIndexInAct,
      currentHp: currentHp ?? run.runPlayerHealth,
      currentGold: currentGold ?? run.runGold,
      maxHp: run.runMaxHealth,
    });
  }

  // ============ Victory / Defeat Effects ============

  useEffect(() => {
    if (screen !== "battle" || battleState.playerHealth > 0) return;
    handleBattleDefeat();
  }, [battleState.playerHealth, screen]);

  useEffect(() => {
    if (screen !== "battle" || battleState.enemyHealth > 0) return;
    if (battleState.playerHealth <= 0) return;
    const transitionTimer = handleBattleVictory();
    return () => clearTimeout(transitionTimer);
  }, [battleState.enemyHealth, battleState.gold, screen]);

  function handleBattleDefeat() {
    onTriggerFarmYieldRef.current();
    playDefeat();
    setHasActiveBattle(false);
    setHoveredCardId(null);
    setScreen("game-over");
  }

  function handleBattleVictory() {
    // Victory state is captured in one sequence so persisted HP, gold/material rewards,
    // reward choices, battle cleanup, audio, and delayed routing agree on the same result.
    const baseGold = randomBetween(GOLD_REWARD_MIN, GOLD_REWARD_MAX);
    const gold = Math.floor(baseGold * (1 + talents.talentEffects.enemyGoldDropBonus));
    const eliteBonus = battleState.currentEnemy.enemyType === "elite" ? Math.floor(gold * ELITE_GOLD_BONUS_FRACTION) : 0;
    const bossBonus = battleState.currentEnemy.enemyType === "boss" ? Math.floor(gold * BOSS_GOLD_BONUS_FRACTION) : 0;
    const newGold = awardVictoryGold(gold, eliteBonus, bossBonus);
    run.setRunPlayerHealth(battleState.playerHealth);
    if (newGold > battleState.gold) playGoldGain();
    if (talents.talentEffects.maxHealthPerCombat > 0) {
      run.setRunMaxHealth((p) => p + talents.talentEffects.maxHealthPerCombat);
    }
    setRewardState(createVictoryRewardState(gold, eliteBonus, bossBonus, newGold, getVictoryMaterials()));
    setHasActiveBattle(false); setHoveredCardId(null); playVictory();
    return setTimeout(() => setScreen("rewards"), VICTORY_TRANSITION_DELAY);
  }

  function awardVictoryGold(gold: number, eliteBonus: number, bossBonus: number) {
    const newGold = getVictoryGoldTotal(battleState, run.runTrinkets, gold, eliteBonus, bossBonus, talents.talentEffects.goldPerCombat);
    run.setRunGold(newGold);
    return newGold;
  }

  function getVictoryMaterials() {
    return getEnemyMaterialLoot(battleState.currentEnemy.id, battleState.currentEnemy.enemyType);
  }

  function createVictoryRewardState(gold: number, eliteBonus: number, bossBonus: number, newGold: number, materials: MaterialInventory) {
    // Boss rewards branch here because bosses advance acts and always offer trinkets,
    // while normal/elite fights continue the destination route with card/trinket rolls.
    if (battleState.currentEnemy.enemyType === "boss") {
      return createBossRewardState(gold, bossBonus, materials);
    }
    return createCombatRewardState(gold, eliteBonus, newGold, materials);
  }

  function createBossRewardState(gold: number, bossBonus: number, materials: MaterialInventory) {
    return createBossRewardStateFromFlow({ gold, bossBonus, talentGoldPerCombat: talents.talentEffects.goldPerCombat, materials });
  }

  function createCombatRewardState(gold: number, eliteBonus: number, newGold: number, materials: MaterialInventory) {
    return createCombatRewardStateFromFlow({
      battleState,
      runDeck: run.runDeck,
      gold,
      eliteBonus,
      talentGoldPerCombat: talents.talentEffects.goldPerCombat,
      materials,
      destinations: sampleDestinationChoices(getAvailableDestinations(battleState.playerHealth, newGold)),
    });
  }

  // ============ Game Flow ============

  function beginRun() {
    // The Play button resumes active progress first; only a truly inactive save should
    // enter character select and create a fresh route.
    if (hasActiveBattle) { returnToBattle(); return; }
    if (hasActiveRun) {
      setRewardState((prev) => ({
        ...prev,
        destinations: prev.destinations.length > 0 ? prev.destinations : sampleDestinationChoices(getAvailableDestinations()),
      }));
      navigateTo("destination");
      return;
    }
    navigateTo("character-select");
  }

  function handleCharacterSelect(selectedId: CharacterId) {
    // Fresh-run fields are initialized together so deck, HP, gold bonuses, route state,
    // discoveries, and active-run flags cannot describe different runs for one render.
    const character = characters[selectedId];
    const freshDeck = [...character.startingDeck];
    run.setCharacter(selectedId);
    run.setRunDeck(freshDeck);
    const homesteadGoldBonus = homesteadEffectsRef.current.startGold;
    const totalStartGold = talents.talentEffects.startGold + homesteadGoldBonus;
    if (totalStartGold > 0) playGoldGain();
    run.setRunGold(totalStartGold);
    run.setRoomsEncountered(0);
    const maxHp = maxPlayerHealth + homesteadEffectsRef.current.startMaxHealthBonus;
    run.setRunPlayerHealth(maxHp);
    run.setRunMaxHealth(maxHp);
    run.setCurrentAct(1);
    run.setDestinationIndexInAct(0);
    run.setCompletedDestinations([]);
    setRewardState(createEmptyRewardState(sampleDestinationChoices(getAvailableDestinations())));
    setDiscoveredCardIds((current) => appendUniqueMany(current, freshDeck.map((c) => c.id)));
    setEncounteredEnemyIds([]);
    setHoveredCardId(null);
    setHasActiveRun(true);
    navigateTo("destination");
  }

  function returnToBattle() { if (hasActiveBattle) { navigateTo("battle"); } }
  function goToScreen(nextScreen: Screen) { setHoveredCardId(null); navigateTo(nextScreen); }

  // ============ Rewards & Destinations ============

  function finishRewards() {
    // Apply materials/card/trinket rewards before routing so the next screen sees the
    // updated deck and collection; boss rewards then diverge into act completion.
    onAddMaterialsRef.current(rewardState.materials);
    if (rewardState.selectedId) {
      const chosen = rewardState.choices.find((c) => c.id === rewardState.selectedId);
      if (chosen) {
        if (rewardState.rewardType === "card") {
          run.setRunDeck((prev) => [...prev, chosen as BattleCard]);
          setDiscoveredCardIds((cur) => appendUnique(cur, chosen.id));
        } else {
          run.setRunTrinkets((prev) => [...prev, chosen.id]);
          setDiscoveredTrinketIds((cur) => appendUnique(cur, chosen.id));
        }
      }
    }
    setRewardState((prev) => createEmptyRewardState(prev.destinations));
    setHoveredCardId(null);

    if (battleStateRef.current.currentEnemy.enemyType === "boss") {
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
    if (destination === "Campfire") navigateTo("campfire");
    else if (destination === "Merchant's Shop") { onInitShop(); navigateTo("shop"); }
    else if (destination === "Alchemist's Shop") { onInitAlchemist(); navigateTo("alchemist"); }
    else if (destination === "Mystery") { setMysteryEvent(pickRandom(mysteryPool) ?? mysteryPool[0]); setMysteryCardChoices(null); navigateTo("mystery"); }
    else if (destination === "Elite Combat") { onStartBattle(undefined, undefined, "elite"); navigateTo("battle"); }
    else if (destination === "Boss Combat") { onStartBossBattle(); navigateTo("battle"); }
    else { onStartBattle(undefined, undefined, "normal"); navigateTo("battle"); }
  }

  function handleActComplete() {
    // Farm yield is a full-run reward, not an act reward. Non-final acts reset only the
    // in-act destination route while preserving deck, gold, HP, and trinkets.
    setHoveredCardId(null);
    setHasActiveBattle(false);

    if (run.currentAct >= ACTS_PER_RUN) {
      onTriggerFarmYieldRef.current();
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

  function advanceToNextDestination() {
    run.setRoomsEncountered((p) => p + 1);
    setRewardState((prev) => ({ ...prev, destinations: sampleDestinationChoices(getAvailableDestinations()) }));
    setHoveredCardId(null); setMysteryCardChoices(null); navigateTo("destination");
  }

  function handleCampfireContinue() {
    const healFraction = CAMPFIRE_HEAL_FRACTION + talents.talentEffects.campfireHealBonus;
    run.setRunPlayerHealth((prev) => Math.min(run.runMaxHealth, prev + Math.floor(run.runMaxHealth * healFraction)));
    advanceToNextDestination();
  }

  // ============ Mystery ============

  function handleMysteryChoice(choice: MysteryChoice) {
    // applyMysteryEffect returns true when an effect opens follow-up UI; that pauses the
    // remaining event flow until the player picks a card/removal target.
    for (const effect of choice.effects) {
      if (applyMysteryEffect(effect, {
        runMaxHealth: run.runMaxHealth,
        setRunDeck: run.setRunDeck,
        setRunGold: run.setRunGold,
        setRunPlayerHealth: run.setRunPlayerHealth,
        setRunTrinkets: run.setRunTrinkets,
        setDiscoveredCardIds,
        setDiscoveredTrinketIds,
        setMysteryCardChoices,
        awardMysteryXP: talents.awardMysteryXP,
        onAddMaterials: onAddMaterialsRef.current,
      })) return;
    }
  }

  function handleMysteryChooseCard(cardId: string) {
    const card = cardLibrary.find((c) => c.id === cardId);
    if (card) {
      addCardToRun(card, { setRunDeck: run.setRunDeck, setDiscoveredCardIds });
    }
    setMysteryCardChoices(null);
  }

  function handleMysteryRemoveCard(index: number) {
    run.setRunDeck((p) => p.filter((_, i) => i !== index));
  }

  function handleMysteryContinue() { advanceToNextDestination(); }

  // ============ State Reset ============

  function resetRunState() {
    // Reset must clear combat animation state, battle/run/talent session state, reward
    // and mystery UI, active flags, and routing together to avoid resuming stale runs.
    clearCardGhosts(); setBattleState(createBattleState(starterDeck, 0));
    run.reset(); talents.resetRunXP();
    setRewardState(createEmptyRewardState());
    setMysteryCardChoices(null); setHoveredCardId(null); setHasActiveBattle(false); setHasActiveRun(false); navigateTo("menu");
  }

  return {
    screen, setScreen,
    rewardState, setRewardState,
    setSelectedRewardId: (id: string | null) => setRewardState((p) => ({ ...p, selectedId: id })),
    get rewardChoices() { return rewardState.choices; },
    get rewardGold() { return rewardState.gold; },
    get rewardMaterials() { return rewardState.materials; },
    get rewardType() { return rewardState.rewardType; },
    get selectedRewardId() { return rewardState.selectedId; },
    get destinationOptions() { return rewardState.destinations; },
    get mysteryEvent() { return mysteryEvent; },
    get mysteryCardChoices() { return mysteryCardChoices; },
    get activeRunData() { return currentActiveRunData; },
    destinationButtonRefs,
    getAvailableDestinations, advanceToNextDestination,
    beginRun, handleCharacterSelect, returnToBattle, goToScreen,
    handleDestinationChoice, handleActComplete, finishRewards,
    handleCampfireContinue,
    handleMysteryChoice, handleMysteryChooseCard, handleMysteryRemoveCard, handleMysteryContinue,
    resetRunState,
  };
}
