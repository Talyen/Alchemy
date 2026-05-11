import { useEffect, useRef, useState } from "react";
import { createBattleState, maxPlayerHealth } from "@/lib/battle";
import { cardLibrary, characters, starterDeck, trinketLibrary, type BattleCard, type CharacterId, type TrinketEntry } from "@/lib/game-data";
import { playVictory, playDefeat, playGoldGain, playGoldSpend } from "@/lib/audio";
import { selectRewardCards, selectRewardTrinkets, REWARD_TRINKET_CHANCE } from "./reward-utils";
import { getAvailableDestinations as getFilteredDestinations } from "./config";
import type { Destination, Screen } from "./types";
import { computeTrinketManifest } from "@/lib/trinkets";
import { getEnemyMaterialLoot } from "@/lib/homestead/loot";
import { emptyInventory, type HomesteadEffectManifest, type MaterialInventory } from "@/lib/homestead/types";
import { mysteryPool, type MysteryChoice, type MysteryEvent } from "./mystery-events";
import {
  ACTS_PER_RUN, BOSS_TRINKET_REWARD_CHOICES, CAMPFIRE_HEAL_FRACTION,
  DESTINATION_CHOICES, DESTINATIONS_PER_ACT, GOLD_REWARD_MAX, GOLD_REWARD_MIN,
  REWARD_CARD_CHOICES, VICTORY_TRANSITION_DELAY,
} from "@/lib/game-constants";
import { randomBetween, sampleItems } from "./utils";
import type { BattleState } from "@/lib/battle";
import type { useRunState } from "./use-run-state";
import type { useTalentState } from "./use-talent-state";

export function useRunNavigation({
  run, talents,
  screen, setScreen, navigateTo,
  battleState, hasActiveBattle, setHasActiveBattle,
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
  const [rewardState, setRewardState] = useState<{
    choices: (BattleCard | TrinketEntry)[]; gold: number;
    materials: MaterialInventory; selectedId: string | null;
    destinations: Destination[]; rewardType: "card" | "trinket";
  }>({ choices: [], gold: 0, materials: emptyInventory(), selectedId: null, destinations: [], rewardType: "card" });
  const [mysteryEvent, setMysteryEvent] = useState<MysteryEvent | null>(null);
  const [mysteryCardChoices, setMysteryCardChoices] = useState<BattleCard[] | null>(null);

  const destinationButtonRefs = useRef<Partial<Record<Destination, HTMLButtonElement | null>>>({});

  function getAvailableDestinations(currentHp?: number, currentGold?: number, destIdxInAct?: number) {
    if ((destIdxInAct ?? run.destinationIndexInAct) >= DESTINATIONS_PER_ACT - 1) {
      return ["Boss Combat"];
    }
    const hp = currentHp ?? run.runPlayerHealth;
    const gold = currentGold ?? run.runGold;
    return getFilteredDestinations(hp, gold, run.runMaxHealth);
  }

  // ============ Victory / Defeat Effects ============

  useEffect(() => {
    if (screen !== "battle" || battleState.playerHealth > 0) return;
    onTriggerFarmYieldRef.current(); playDefeat(); setHasActiveBattle(false); setHoveredCardId(null); setScreen("game-over"); // eslint-disable-line react-hooks/set-state-in-effect
  }, [battleState.playerHealth, screen]);

  useEffect(() => {
    if (screen !== "battle" || battleState.enemyHealth > 0) return;
    if (battleState.playerHealth <= 0) return;
    const baseGold = randomBetween(GOLD_REWARD_MIN, GOLD_REWARD_MAX);
    const gold = Math.floor(baseGold * (1 + talents.talentEffects.enemyGoldDropBonus));
    const eliteBonus = battleState.currentEnemy.enemyType === "elite" ? Math.floor(gold * 0.3) : 0;
    const bossBonus = battleState.currentEnemy.enemyType === "boss" ? Math.floor(gold * 0.5) : 0;
    const trinketGoldBonus = computeTrinketManifest(run.runTrinkets).smugglersMapGoldBonus;
    const newHp = battleState.playerHealth;
    const newGold = battleState.gold + gold + eliteBonus + bossBonus + talents.talentEffects.goldPerCombat + trinketGoldBonus;
    run.setRunPlayerHealth(newHp);
    run.setRunGold(newGold);
    if (newGold > battleState.gold) playGoldGain();
    const materials = getEnemyMaterialLoot(battleState.currentEnemy.id, battleState.currentEnemy.enemyType);
    setRewardState((prev) => ({ ...prev, materials })); // eslint-disable-line react-hooks/set-state-in-effect
    if (talents.talentEffects.maxHealthPerCombat > 0) {
      run.setRunMaxHealth((p) => p + talents.talentEffects.maxHealthPerCombat);
    }
    const isBoss = battleState.currentEnemy.enemyType === "boss";
    const isElite = battleState.currentEnemy.enemyType === "elite";
    if (isBoss) {
      setRewardState({
        rewardType: "trinket",
        choices: selectRewardTrinkets(trinketLibrary, BOSS_TRINKET_REWARD_CHOICES),
        gold: gold + bossBonus + talents.talentEffects.goldPerCombat,
        materials: emptyInventory(), selectedId: null, destinations: [],
      });
    } else {
      const trinketChance = isElite ? 0.75 : REWARD_TRINKET_CHANCE;
      const offerTrinket = Math.random() < trinketChance;
      setRewardState({
        rewardType: offerTrinket ? "trinket" : "card",
        choices: offerTrinket ? selectRewardTrinkets(trinketLibrary, REWARD_CARD_CHOICES) : selectRewardCards(run.runDeck, cardLibrary, REWARD_CARD_CHOICES),
        gold: offerTrinket ? 0 : gold + eliteBonus + talents.talentEffects.goldPerCombat,
        materials: emptyInventory(), selectedId: null, destinations: sampleItems(getAvailableDestinations(newHp, newGold), DESTINATION_CHOICES),
      });
    }
    setHasActiveBattle(false); setHoveredCardId(null); playVictory();
    const t = setTimeout(() => setScreen("rewards"), VICTORY_TRANSITION_DELAY);
    return () => clearTimeout(t);
  }, [battleState.enemyHealth, battleState.gold, screen]);

  // ============ Game Flow ============

  function beginRun() { if (hasActiveBattle) { returnToBattle(); return; } navigateTo("character-select"); }

  function handleCharacterSelect(selectedId: CharacterId) {
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
    setRewardState({
      choices: [], gold: 0, materials: emptyInventory(), selectedId: null,
      destinations: sampleItems(getAvailableDestinations(), DESTINATION_CHOICES),
      rewardType: "card",
    });
    setDiscoveredCardIds((current) => Array.from(new Set([...current, ...freshDeck.map((c) => c.id)])));
    setEncounteredEnemyIds([]);
    setHoveredCardId(null);
    navigateTo("destination");
  }

  function returnToBattle() { if (hasActiveBattle) { navigateTo("battle"); } }
  function goToScreen(nextScreen: Screen) { setHoveredCardId(null); navigateTo(nextScreen); }

  // ============ Rewards & Destinations ============

  function finishRewards() {
    onAddMaterialsRef.current(rewardState.materials);
    if (rewardState.selectedId) {
      const chosen = rewardState.choices.find((c) => c.id === rewardState.selectedId);
      if (chosen) {
        if (rewardState.rewardType === "card") {
          run.setRunDeck((prev) => [...prev, chosen as BattleCard]);
          setDiscoveredCardIds((cur) => cur.includes(chosen.id) ? cur : [...cur, chosen.id]);
        } else {
          run.setRunTrinkets((prev) => [...prev, chosen.id]);
          setDiscoveredTrinketIds((cur) => cur.includes(chosen.id) ? cur : [...cur, chosen.id]);
        }
      }
    }
    setRewardState((prev) => ({ choices: [], gold: 0, materials: emptyInventory(), selectedId: null, destinations: prev.destinations, rewardType: "card" }));
    setHoveredCardId(null);

    if (battleStateRef.current.currentEnemy.enemyType === "boss") {
      handleActComplete();
      return;
    }

    navigateTo("destination");
  }

  function handleDestinationChoice(destination: Destination) {
    run.setCompletedDestinations((prev) => [...prev, destination]);
    run.setDestinationIndexInAct((p) => p + 1);

    setHoveredCardId(null);
    if (destination === "Campfire") navigateTo("campfire");
    else if (destination === "Merchant's Shop") { onInitShop(); navigateTo("shop"); }
    else if (destination === "Alchemist's Shop") { onInitAlchemist(); navigateTo("alchemist"); }
    else if (destination === "Mystery") { setMysteryEvent(mysteryPool[Math.floor(Math.random() * mysteryPool.length)]); setMysteryCardChoices(null); navigateTo("mystery"); }
    else if (destination === "Elite Combat") { onStartBattle(undefined, undefined, "elite"); navigateTo("battle"); }
    else if (destination === "Boss Combat") { onStartBossBattle(); navigateTo("battle"); }
    else { onStartBattle(undefined, undefined, "normal"); navigateTo("battle"); }
  }

  function handleActComplete() {
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
        destinations: sampleItems(getAvailableDestinations(undefined, undefined, 0), DESTINATION_CHOICES),
      }));
      navigateTo("destination");
    }
  }

  function advanceToNextDestination() {
    run.setRoomsEncountered((p) => p + 1);
    setRewardState((prev) => ({ ...prev, destinations: sampleItems(getAvailableDestinations(), DESTINATION_CHOICES) }));
    setHoveredCardId(null); setMysteryCardChoices(null); navigateTo("destination");
  }

  function handleCampfireContinue() {
    const healFraction = CAMPFIRE_HEAL_FRACTION + talents.talentEffects.campfireHealBonus;
    run.setRunPlayerHealth((prev) => Math.min(run.runMaxHealth, prev + Math.floor(run.runMaxHealth * healFraction)));
    advanceToNextDestination();
  }

  // ============ Mystery ============

  function handleMysteryChoice(choice: MysteryChoice) {
    for (const effect of choice.effects) {
      switch (effect.kind) {
        case "addCard": {
          const card = cardLibrary.find((c) => c.id === effect.cardId);
          if (card) { run.setRunDeck((p) => [...p, card]); setDiscoveredCardIds((cur) => cur.includes(card.id) ? cur : [...cur, card.id]); }
          break;
        }
        case "addRandomCard": {
          const pool = cardLibrary.filter((c) => c.id !== "mixed-potion");
          const card = pool[Math.floor(Math.random() * pool.length)];
          run.setRunDeck((p) => [...p, card]);
          setDiscoveredCardIds((cur) => cur.includes(card.id) ? cur : [...cur, card.id]);
          break;
        }
        case "chooseCard": {
          const pool = cardLibrary.filter((c) => c.id !== "mixed-potion");
          const choices = sampleItems(pool, 3);
          setMysteryCardChoices(choices);
          return;
        }
        case "healHP":
          if (effect.chance !== undefined && Math.random() >= effect.chance) break;
          run.setRunPlayerHealth((p) => Math.min(run.runMaxHealth, p + effect.amount));
          break;
        case "damageHP":
          run.setRunPlayerHealth((p) => Math.max(0, p - effect.amount));
          break;
        case "gainGold":
          if (effect.amount > 0) playGoldGain();
          run.setRunGold((p) => p + effect.amount);
          break;
        case "loseGold":
          if (effect.amount > 0) playGoldSpend();
          run.setRunGold((p) => Math.max(0, p - effect.amount));
          break;
        case "gainMaxMana":
          break;
        case "gainXP":
          talents.awardMysteryXP(effect.keyword, effect.amount);
          break;
        case "removeCard":
          if (effect.mode === "random") {
            run.setRunDeck((p) => {
              if (p.length === 0) return p;
              const idx = Math.floor(Math.random() * p.length);
              return p.filter((_, i) => i !== idx);
            });
          }
          break;
        case "gainTrinket":
          run.setRunTrinkets((p) => [...p, effect.trinketId]);
          setDiscoveredTrinketIds((cur) => cur.includes(effect.trinketId) ? cur : [...cur, effect.trinketId]);
          break;
        case "gainRandomTrinket": {
          const randomTrinket = sampleItems(trinketLibrary, 1)[0];
          if (randomTrinket) {
            run.setRunTrinkets((p) => [...p, randomTrinket.id]);
            setDiscoveredTrinketIds((cur) => cur.includes(randomTrinket.id) ? cur : [...cur, randomTrinket.id]);
          }
          break;
        }
        case "gainMaterial": {
          const matInv = emptyInventory();
          matInv[effect.material] = effect.amount;
          onAddMaterialsRef.current(matInv);
          break;
        }
        case "none":
          break;
      }
    }
  }

  function handleMysteryChooseCard(cardId: string) {
    const card = cardLibrary.find((c) => c.id === cardId);
    if (card) {
      run.setRunDeck((p) => [...p, card]);
      setDiscoveredCardIds((cur) => cur.includes(card.id) ? cur : [...cur, card.id]);
    }
    setMysteryCardChoices(null);
  }

  function handleMysteryRemoveCard(index: number) {
    run.setRunDeck((p) => p.filter((_, i) => i !== index));
  }

  function handleMysteryContinue() { advanceToNextDestination(); }

  // ============ State Reset ============

  function resetRunState() {
    clearCardGhosts(); setBattleState(createBattleState(starterDeck, 0));
    run.reset(); talents.resetRunXP();
    setRewardState({ choices: [], gold: 0, materials: emptyInventory(), selectedId: null, destinations: [], rewardType: "card" });
    setMysteryCardChoices(null); setHoveredCardId(null); setHasActiveBattle(false); navigateTo("menu");
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
    get activeRunData() { return hasActiveBattle ? { characterId: run.characterId } : null; },
    destinationButtonRefs,
    getAvailableDestinations, advanceToNextDestination,
    beginRun, handleCharacterSelect, returnToBattle, goToScreen,
    handleDestinationChoice, handleActComplete, finishRewards,
    handleCampfireContinue,
    handleMysteryChoice, handleMysteryChooseCard, handleMysteryRemoveCard, handleMysteryContinue,
    resetRunState,
  };
}
