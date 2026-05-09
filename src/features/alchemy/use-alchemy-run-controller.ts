import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { chooseWishCard, createBattleState, endPlayerTurn, maxPlayerHealth, playBattleCardResolved, getEffectiveCost, processCompanionTurnStart, type BattleState, type CombatTextEvent } from "@/lib/battle";
import { cardLibrary, characters, starterDeck, trinketLibrary, type BattleCard, type CharacterId, type TrinketEntry } from "@/lib/game-data";
import { playVictory, playDefeat, playCardSound, playEnemyAttack, playGoldGain, playGoldSpend } from "@/lib/audio";
import { selectRewardCards, selectRewardTrinkets, REWARD_TRINKET_CHANCE } from "./reward-utils";
import { getAvailableDestinations as getFilteredDestinations, getCurrentEnemy, getBossEnemy } from "./config";
import { useCardGhosts, useFloatingCombatTexts, useShimmerController } from "./hooks";
import { animateCardActivation } from "./run-controller-helpers";
import type { Destination, Screen } from "./types";
import { useTalentState } from "./use-talent-state";
import { useRunState } from "./use-run-state";
import type { TalentXP } from "@/lib/talents";
import { computeTrinketManifest } from "@/lib/trinkets";
import { getEnemyMaterialLoot } from "@/lib/homestead/loot";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import { emptyInventory, type HomesteadEffectManifest, type MaterialInventory } from "@/lib/homestead/types";
import type { UnlockedTalents } from "./talent-pool";
import { mysteryPool, type MysteryChoice, type MysteryEvent } from "./mystery-events";
import { createMixedPotion, applyMixToDeck } from "./potion-mixer";
import { AUTO_END_TURN_DELAY, ALCHEMIST_MIX_PRICE, ALCHEMIST_POTION_PRICE, ALCHEMIST_REFRESH_PRICE, CAMPFIRE_HEAL_FRACTION, COMPANION_ATTACK_DELAY, DESTINATION_CHOICES, DESTINATIONS_PER_ACT, ACTS_PER_RUN, BOSS_TRINKET_REWARD_CHOICES, ENEMY_PHASE_DELAY, GOLD_REWARD_MAX, GOLD_REWARD_MIN, REWARD_CARD_CHOICES, SHAKE_DURATION, SHOP_CARD_PRICE, SHOP_REFRESH_PRICE, SHOP_REMOVE_PRICE, VICTORY_TRANSITION_DELAY } from "@/lib/game-constants";
import { getCardRect, getEnemyStatusChips, getHoverId, getPlayerStatusChips, randomBetween, resampleItems, sampleItems } from "./utils";

type SetStringList = React.Dispatch<React.SetStateAction<string[]>>;

export function useAlchemyRunController({
  discoveredCardIds, setDiscoveredCardIds, setEncounteredEnemyIds,
  discoveredTrinketIds, setDiscoveredTrinketIds,
  initialTalentXP, initialUnlockedTalents, initialActiveRun, autoEndTurn,
  onAddMaterials, onTriggerFarmYield, homesteadEffects,
}: {
  discoveredCardIds: string[];
  setDiscoveredCardIds: SetStringList; setEncounteredEnemyIds: SetStringList;
  discoveredTrinketIds: string[]; setDiscoveredTrinketIds: SetStringList;
  initialTalentXP: TalentXP; initialUnlockedTalents: UnlockedTalents;
  initialActiveRun: { characterId: CharacterId } | null;
  autoEndTurn: boolean;
  onAddMaterials: (materials: MaterialInventory) => void;
  onTriggerFarmYield: () => void;
  homesteadEffects: HomesteadEffectManifest;
}) {
  // ============ Sub-hooks ============
  const talents = useTalentState(initialTalentXP, initialUnlockedTalents);
  const run = useRunState(initialActiveRun);

  // ============ Core Screen / Battle State ============
  const [screen, setScreen] = useState<Screen>("menu");
  const [battleState, setBattleState] = useState<BattleState>(() => createBattleState(starterDeck, 0));
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hasActiveBattle, setHasActiveBattle] = useState(initialActiveRun !== null);
  const [enemyShaking, setEnemyShaking] = useState(false);
  const [playerShaking, setPlayerShaking] = useState(false);
  const [companionShaking, setCompanionShaking] = useState(false);

  // Filters the destination pool based on current game state.
  function getAvailableDestinations(currentHp?: number, currentGold?: number) {
    const hp = currentHp ?? run.runPlayerHealth;
    const gold = currentGold ?? run.runGold;
    return getFilteredDestinations(hp, gold, run.runMaxHealth);
  }

  // ============ Reward / Shop State ============
  const [rewardState, setRewardState] = useState<{ choices: (BattleCard | TrinketEntry)[]; gold: number; selectedId: string | null; destinations: Destination[]; rewardType: "card" | "trinket" }>({ choices: [], gold: 0, selectedId: null, destinations: [], rewardType: "card" });
  const [shopState, setShopState] = useState<{ cards: BattleCard[]; refreshesLeft: number; removeUsed: boolean; firstPurchaseUsed: boolean }>({ cards: [], refreshesLeft: 1, removeUsed: false, firstPurchaseUsed: false });
  const [alchemistState, setAlchemistState] = useState<{ potions: BattleCard[]; refreshesLeft: number; mixUsed: boolean; firstPurchaseUsed: boolean }>({ potions: [], refreshesLeft: 1, mixUsed: false, firstPurchaseUsed: false });
  const [mysteryEvent, setMysteryEvent] = useState<MysteryEvent | null>(null);

  // ============ Refs ============
  const handCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const battleSceneRef = useRef<HTMLDivElement | null>(null);
  const playerPanelRef = useRef<HTMLDivElement | null>(null);
  const enemyPanelRef = useRef<HTMLDivElement | null>(null);
  const destinationButtonRefs = useRef<Partial<Record<Destination, HTMLButtonElement | null>>>({});
  const navTimerRef = useRef<number>(0);
  const cardPlayInProgressRef = useRef(false);
  const companionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const companionScheduledRef = useRef(false);
  const battleStateRef = useRef(battleState);
  const handleEndTurnRef = useRef(handleEndTurn);

  useEffect(() => { battleStateRef.current = battleState; }, [battleState]);
  useEffect(() => { handleEndTurnRef.current = handleEndTurn; }, [handleEndTurn]);

  const onAddMaterialsRef = useRef(onAddMaterials);
  const onTriggerFarmYieldRef = useRef(onTriggerFarmYield);
  const homesteadEffectsRef = useRef(homesteadEffects);
  useEffect(() => { onAddMaterialsRef.current = onAddMaterials; }, [onAddMaterials]);
  useEffect(() => { onTriggerFarmYieldRef.current = onTriggerFarmYield; }, [onTriggerFarmYield]);
  useEffect(() => { homesteadEffectsRef.current = homesteadEffects; }, [homesteadEffects]);

  useEffect(() => () => window.clearTimeout(navTimerRef.current), []);
  useEffect(() => () => { if (companionTimeoutRef.current) clearTimeout(companionTimeoutRef.current); }, []);

  // ============ Hooks ============
  const { cardGhosts, removeCardGhost, clearCardGhosts, spawnCardGhost } = useCardGhosts();
  const { floatingCombatTexts, showCombatTexts } = useFloatingCombatTexts();
  const { shimmerState, maybeTriggerShimmer } = useShimmerController();

  // ============ Derived State ============
  const playerStatusChips = useMemo(() => getPlayerStatusChips(battleState), [battleState]);
  const enemyStatusChips = useMemo(() => getEnemyStatusChips(battleState), [battleState]);
  const playerCombatTexts = useMemo(() => floatingCombatTexts.filter((e) => e.target === "player"), [floatingCombatTexts]);
  const enemyCombatTexts = useMemo(() => floatingCombatTexts.filter((e) => e.target === "enemy"), [floatingCombatTexts]);

  // ============ Effects ============
  const autoEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleAutoEndTurn(state: BattleState = battleState) {
    if (autoEndTimerRef.current) clearTimeout(autoEndTimerRef.current);
    autoEndTimerRef.current = null;
    if (!autoEndTurn || screen !== "battle" || state.turnPhase !== "player" || state.enemyHealth <= 0 || state.playerHealth <= 0 || state.wishOptions) return;
    const hasPlayableCard = state.hand.some((card) => state.mana >= getEffectiveCost(state, card));
    if (hasPlayableCard) return;
    autoEndTimerRef.current = setTimeout(() => handleEndTurnRef.current(), AUTO_END_TURN_DELAY);
  }

  useEffect(() => {
    scheduleAutoEndTurn();
    return () => { if (autoEndTimerRef.current) clearTimeout(autoEndTimerRef.current); };
  }, [autoEndTurn, battleState, screen]);

  useEffect(() => {
    if (screen !== "battle" || battleState.playerHealth > 0) return;
    onTriggerFarmYieldRef.current(); playDefeat(); setHasActiveBattle(false); setHoveredCardId(null); setMenuOpen(false); setScreen("game-over");
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
    onAddMaterialsRef.current(materials);
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
        selectedId: null, destinations: [],
      });
    } else {
      const trinketChance = isElite ? 0.75 : REWARD_TRINKET_CHANCE;
      const offerTrinket = Math.random() < trinketChance;
      setRewardState({
        rewardType: offerTrinket ? "trinket" : "card",
        choices: offerTrinket ? selectRewardTrinkets(trinketLibrary, REWARD_CARD_CHOICES) : selectRewardCards(run.runDeck, cardLibrary, REWARD_CARD_CHOICES),
        gold: offerTrinket ? 0 : gold + eliteBonus + talents.talentEffects.goldPerCombat,
        selectedId: null, destinations: sampleItems(getAvailableDestinations(newHp, newGold), DESTINATION_CHOICES),
      });
    }
    setHasActiveBattle(false); setHoveredCardId(null); setMenuOpen(false); playVictory();
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
      choices: [], gold: 0, selectedId: null,
      destinations: sampleItems(getAvailableDestinations(), DESTINATION_CHOICES),
      rewardType: "card",
    });
    setDiscoveredCardIds((current) => Array.from(new Set([...current, ...freshDeck.map((c) => c.id)])));
    setEncounteredEnemyIds([]);
    setHoveredCardId(null);
    navigateTo("destination");
  }

  function startBattle(deck: BattleCard[] = run.runDeck, gold: number = run.runGold, enemyType: "normal" | "elite" = "normal") {
    const enemy = getCurrentEnemy(run.roomsEncountered, enemyType);
    const grovesHeal = computeTrinketManifest(run.runTrinkets).grovesFavorStartHeal;
    if (grovesHeal > 0) run.setRunPlayerHealth((p) => Math.min(run.runMaxHealth, p + grovesHeal));
    run.setRoomsEncountered((p) => p + 1);
    clearCardGhosts();
    const mergedEffects = mergeIntoManifest(talents.talentEffects, homesteadEffectsRef.current);
    setBattleState(createBattleState(deck, gold, run.roomsEncountered, enemy, run.runPlayerHealth, mergedEffects, discoveredCardIds, run.runMaxHealth, run.runTrinkets, run.destinationIndexInAct, run.currentAct));
    setHasActiveBattle(true); setHoveredCardId(null); setMenuOpen(false); setRewardState((p) => ({ ...p, selectedId: null })); navigateTo("battle");
    setEncounteredEnemyIds((current) => current.includes(enemy.id) ? current : [...current, enemy.id]);
  }

  function startBossBattle() {
    const enemy = getBossEnemy(run.currentAct);
    const grovesHeal = computeTrinketManifest(run.runTrinkets).grovesFavorStartHeal;
    if (grovesHeal > 0) run.setRunPlayerHealth((p) => Math.min(run.runMaxHealth, p + grovesHeal));
    run.setRoomsEncountered((p) => p + 1);
    clearCardGhosts();
    const mergedEffects = mergeIntoManifest(talents.talentEffects, homesteadEffectsRef.current);
    setBattleState(createBattleState(run.runDeck, run.runGold, run.roomsEncountered, enemy, run.runPlayerHealth, mergedEffects, discoveredCardIds, run.runMaxHealth, run.runTrinkets, run.destinationIndexInAct, run.currentAct));
    setHasActiveBattle(true); setHoveredCardId(null); setMenuOpen(false); setRewardState((p) => ({ ...p, selectedId: null })); navigateTo("battle");
    setEncounteredEnemyIds((current) => current.includes(enemy.id) ? current : [...current, enemy.id]);
  }

  function returnToBattle() { if (hasActiveBattle) { setMenuOpen(false); navigateTo("battle"); } }
  function goToScreen(nextScreen: Screen) { setHoveredCardId(null); setMenuOpen(false); navigateTo(nextScreen); }

  function navigateTo(nextScreen: Screen) {
    window.clearTimeout(navTimerRef.current);
    navTimerRef.current = window.setTimeout(() => setScreen(nextScreen), 100);
  }

  // ============ Card Play ============
  function handleCardClick(card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) {
    handlePlayCard(card, index, getCardRect(event.currentTarget.getBoundingClientRect()));
  }

  function handlePlayCard(card: BattleCard, index: number, sourceRect: { x: number; y: number; width: number; height: number }) {
    if (screen !== "battle" || battleState.mana < getEffectiveCost(battleState, card) || battleState.wishOptions || battleState.turnPhase !== "player" || cardPlayInProgressRef.current) return;
    cardPlayInProgressRef.current = true;
    animateCardActivation(card, sourceRect, (index - (battleState.hand.length - 1) / 2) * 4.2, playerPanelRef, enemyPanelRef, battleSceneRef, spawnCardGhost);
    playCardSound(card.id);
    const resolution = playBattleCardResolved(battleState, card.id, index);
    if (resolution.state.gold > battleState.gold && card.id !== "steal") playGoldGain();
    if (resolution.combatTexts.some((ct) => ct.kind === "damage" && ct.target === "enemy")) { setEnemyShaking(true); setTimeout(() => setEnemyShaking(false), SHAKE_DURATION); }
    setBattleState(resolution.state);
    showCombatTexts(resolution.combatTexts);
    setHoveredCardId((current) => (current === getHoverId("hand", `${card.id}-${card.uid}`) ? null : current));
    talents.awardCardXP(card);
    cardPlayInProgressRef.current = false;
    scheduleAutoEndTurn(resolution.state);
  }

  function handleWishChoice(card: BattleCard) {
    setBattleState((current) => chooseWishCard(current, card.id));
    setDiscoveredCardIds((current) => current.includes(card.id) ? current : [...current, card.id]);
  }

  // ============ Rewards & Destinations ============
  function finishRewards() {
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
    setRewardState((prev) => ({ choices: [], gold: 0, selectedId: null, destinations: prev.destinations, rewardType: "card" }));
    setHoveredCardId(null);

    // Boss was the last enemy → act complete (no destination screen)
    if (battleState.currentEnemy.enemyType === "boss") {
      handleActComplete();
      return;
    }

    // All 7 non-boss slots filled → auto-start boss fight
    if (run.destinationIndexInAct >= DESTINATIONS_PER_ACT - 1) {
      startBossBattle();
      return;
    }

    navigateTo("destination");
  }

  function handleDestinationChoice(destination: Destination) {
    // Record choice in act timeline
    run.setCompletedDestinations((prev) => [...prev, destination]);
    run.setDestinationIndexInAct((p) => p + 1);

    setHoveredCardId(null); setMenuOpen(false);
    if (destination === "Campfire") navigateTo("campfire");
    else if (destination === "Merchant's Shop") { setShopState({ cards: sampleItems(cardLibrary, 3), refreshesLeft: 1, removeUsed: false, firstPurchaseUsed: false }); navigateTo("shop"); }
    else if (destination === "Alchemist's Shop") { const potions = sampleItems(cardLibrary.filter((c) => c.id.includes("potion") && c.id !== "mixed-potion"), 3); setAlchemistState({ potions, refreshesLeft: 1, mixUsed: false, firstPurchaseUsed: false }); navigateTo("alchemist"); }
    else if (destination === "Mystery") { setMysteryEvent(mysteryPool[Math.floor(Math.random() * mysteryPool.length)]); navigateTo("mystery"); }
    else if (destination === "Elite Combat") startBattle(undefined, undefined, "elite");
    else startBattle(undefined, undefined, "normal");
  }

  // Called after a boss is defeated — advances act or shows victory.
  function handleActComplete() {
    setHoveredCardId(null); setMenuOpen(false);
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
        destinations: sampleItems(getAvailableDestinations(), DESTINATION_CHOICES),
      }));
      navigateTo("destination");
    }
  }

  function handleShopBuyCard(card: BattleCard) {
    let price = Math.max(0, SHOP_CARD_PRICE - talents.talentEffects.shopCardDiscount);
    if (!shopState.firstPurchaseUsed && run.runTrinkets.includes("merchants-favor")) {
      price = Math.max(0, price - 7);
    }
    if (run.runGold < price) return;
    if (price > 0) playGoldSpend();
    run.setRunGold((p) => Math.max(0, p - price)); run.setRunDeck((p) => [...p, card]);
    setDiscoveredCardIds((cur) => cur.includes(card.id) ? cur : [...cur, card.id]);
    setShopState((p) => ({ ...p, firstPurchaseUsed: true }));
  }

  function handleShopRemoveCard(index: number) {
    const price = Math.max(0, SHOP_REMOVE_PRICE - talents.talentEffects.removeCardDiscount);
    if (run.runGold < price) return;
    if (price > 0) playGoldSpend();
    run.setRunGold((p) => Math.max(0, p - price)); run.setRunDeck((p) => p.filter((_, i) => i !== index));
    setShopState((p) => ({ ...p, removeUsed: true }));
  }

  function handleShopRefresh() {
    const price = talents.talentEffects.shopFreeRefresh && shopState.refreshesLeft > 0 ? 0 : SHOP_REFRESH_PRICE;
    if (shopState.refreshesLeft <= 0 || run.runGold < price) return;
    if (price > 0) playGoldSpend();
    run.setRunGold((g) => Math.max(0, g - price));
    setShopState((p) => ({ ...p, cards: resampleItems(cardLibrary, p.cards, 3), refreshesLeft: 0 }));
  }

  // Shared tail for progressing from any destination: increment room, check boss trigger,
  // refresh destination choices, and navigate to the destination screen.
  function advanceToNextDestination() {
    run.setRoomsEncountered((p) => p + 1);
    if (run.destinationIndexInAct >= DESTINATIONS_PER_ACT - 1) {
      startBossBattle(); return;
    }
    setRewardState((prev) => ({ ...prev, destinations: sampleItems(getAvailableDestinations(), DESTINATION_CHOICES) }));
    setHoveredCardId(null); setMenuOpen(false); navigateTo("destination");
  }

  function handleShopContinue() { advanceToNextDestination(); }

  function handleCampfireContinue() {
    const healFraction = CAMPFIRE_HEAL_FRACTION + talents.talentEffects.campfireHealBonus;
    run.setRunPlayerHealth((prev) => Math.min(run.runMaxHealth, prev + Math.floor(run.runMaxHealth * healFraction)));
    advanceToNextDestination();
  }

  function handleAlchemistRefresh() {
    const potionPool = cardLibrary.filter((c) => c.id.includes("potion") && c.id !== "mixed-potion");
    if (alchemistState.refreshesLeft <= 0 || run.runGold < ALCHEMIST_REFRESH_PRICE) return;
    playGoldSpend();
    run.setRunGold((g) => Math.max(0, g - ALCHEMIST_REFRESH_PRICE));
    setAlchemistState((p) => ({ ...p, potions: resampleItems(potionPool, p.potions, 3), refreshesLeft: 0 }));
  }

  function handleAlchemistBuyCard(card: BattleCard) {
    let price = Math.max(0, ALCHEMIST_POTION_PRICE - talents.talentEffects.potionDiscount);
    if (!alchemistState.firstPurchaseUsed && run.runTrinkets.includes("merchants-favor")) {
      price = Math.max(0, price - 7);
    }
    if (run.runGold < price) return;
    if (price > 0) playGoldSpend();
    run.setRunGold((p) => Math.max(0, p - price)); run.setRunDeck((p) => [...p, card]);
    setDiscoveredCardIds((cur) => cur.includes(card.id) ? cur : [...cur, card.id]);
    setAlchemistState((p) => ({ ...p, firstPurchaseUsed: true }));
  }

  function handleAlchemistMixPotions(indexA: number, indexB: number) {
    const price = Math.max(0, ALCHEMIST_MIX_PRICE - talents.talentEffects.mixPotionDiscount);
    if (run.runGold < price) return;
    const deck = run.runDeck;
    const highIdx = Math.max(indexA, indexB);
    const lowIdx = Math.min(indexA, indexB);
    const cardA = deck[highIdx];
    const cardB = deck[lowIdx];

    let mixed: BattleCard;
    try {
      mixed = createMixedPotion(cardA, cardB);
    } catch {
      return;
    }

    if (price > 0) playGoldSpend();
    run.setRunGold((p) => Math.max(0, p - price));
    run.setRunDeck((p) => applyMixToDeck(p, indexA, indexB, mixed));
    setAlchemistState((p) => ({ ...p, mixUsed: true }));
    setDiscoveredCardIds((cur) => cur.includes("mixed-potion") ? cur : [...cur, "mixed-potion"]);
  }

  function handleAlchemistContinue() { advanceToNextDestination(); }

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

  function handleMysteryRemoveCard(index: number) {
    run.setRunDeck((p) => p.filter((_, i) => i !== index));
  }

  function handleMysteryContinue() { advanceToNextDestination(); }

  // ============ Turn Management ============
  function handleEndTurn() {
    if (screen !== "battle" || battleState.turnPhase !== "player" || battleState.wishOptions || cardPlayInProgressRef.current) return;

    // Clear pending companion timer (player ended turn before companion attacked)
    if (companionTimeoutRef.current) {
      clearTimeout(companionTimeoutRef.current);
      companionTimeoutRef.current = null;
    }

    // If companion hasn't attacked yet this turn, do it now at end of turn
    let currentState = battleState;
    const preCombatTexts: CombatTextEvent[] = [];
    if (companionScheduledRef.current && currentState.activeCompanion) {
      playCardSound(`companion-${currentState.activeCompanion.id}`);
      currentState = processCompanionTurnStart(currentState, preCombatTexts);
      setCompanionShaking(true);
      setTimeout(() => setCompanionShaking(false), SHAKE_DURATION);
    }
    companionScheduledRef.current = false;

    // Enemy phase + draw new hand (companion attack is no longer part of this)
    const result = endPlayerTurn(currentState);

    // Combine end-of-turn companion texts with enemy phase texts
    const combinedCombatTexts = [...preCombatTexts, ...result.combatTexts];

    setBattleState({ ...result.state, turnPhase: "enemy", hand: [], playerHealth: currentState.playerHealth, playerStatuses: currentState.playerStatuses });
    const dotTexts = combinedCombatTexts.filter((ct) => ct.target === "enemy");
    if (dotTexts.length > 0) showCombatTexts(dotTexts);
    if (result.state.enemyHealth <= 0) return;
    const playerTexts = combinedCombatTexts.filter((ct) => ct.target === "player");
    setTimeout(() => {
      playEnemyAttack(currentState.currentEnemy.id);
      setBattleState(result.state);
      if (playerTexts.length > 0) showCombatTexts(playerTexts);
      if (playerTexts.some((ct) => ct.kind === "damage")) { setPlayerShaking(true); setTimeout(() => setPlayerShaking(false), SHAKE_DURATION); }

      // Schedule companion attack for 1 second into the new turn
      if (result.state.activeCompanion) {
        companionTimeoutRef.current = setTimeout(() => {
          const texts: CombatTextEvent[] = [];
          if (battleStateRef.current.activeCompanion) {
            playCardSound(`companion-${battleStateRef.current.activeCompanion.id}`);
          }
          const newState = processCompanionTurnStart(battleStateRef.current, texts);
          setBattleState(newState);
          setCompanionShaking(true);
          setTimeout(() => setCompanionShaking(false), SHAKE_DURATION);
          if (texts.length > 0) showCombatTexts(texts);
          companionTimeoutRef.current = null;
          companionScheduledRef.current = false;
        }, COMPANION_ATTACK_DELAY);
        companionScheduledRef.current = true;
      }
    }, ENEMY_PHASE_DELAY);
  }

  function handleEndRun() { if (screen !== "battle") return; setBattleState((c) => ({ ...c, playerHealth: 0 })); }
  function skipCombatDevMode() { if (screen === "battle") { setMenuOpen(false); setBattleState((c) => ({ ...c, enemyHealth: 0, wishOptions: null })); } }

  // ============ State Reset ============
  function resetRunState() {
    clearCardGhosts(); setBattleState(createBattleState(starterDeck, 0));
    run.reset(); talents.resetRunXP();
    setRewardState({ choices: [], gold: 0, selectedId: null, destinations: [], rewardType: "card" });
    setHoveredCardId(null); setMenuOpen(false); setHasActiveBattle(false); navigateTo("menu");
  }

  function clearPermanentData() { talents.clearPermanentData(); }

  // ============ Return ============
  return {
    screen, battleState, hoveredCardId, menuOpen, hasActiveBattle,
    runDeck: run.runDeck, runGold: run.runGold, runPlayerHealth: run.runPlayerHealth, runMaxHealth: run.runMaxHealth,
    runTrinkets: run.runTrinkets, roomsEncountered: run.roomsEncountered,
    currentAct: run.currentAct, destinationIndexInAct: run.destinationIndexInAct,
    completedDestinations: run.completedDestinations,
    characterId: run.characterId,
    talentXP: talents.talentXP, runTalentXP: talents.runTalentXP, unlockedTalents: talents.unlockedTalents,
    unlockTalent: talents.unlockTalent, unlockAllTalents: talents.unlockAllTalents, resetUnlockedTalents: talents.resetUnlockedTalents,
    clearPermanentData,
    setRewardState, setHoveredCardId, setMenuOpen,
    setSelectedRewardId: (id: string | null) => setRewardState((p) => ({ ...p, selectedId: id })),
    get rewardChoices() { return rewardState.choices; }, get rewardGold() { return rewardState.gold; },
    get rewardType() { return rewardState.rewardType; }, get selectedRewardId() { return rewardState.selectedId; },
    get destinationOptions() { return rewardState.destinations; },
    get shopCards() { return shopState.cards; }, get shopRefreshesLeft() { return shopState.refreshesLeft; },
    get shopRemoveUsed() { return shopState.removeUsed; },
    get alchemistPotions() { return alchemistState.potions; }, get alchemistRefreshesLeft() { return alchemistState.refreshesLeft; },
    get alchemistMixUsed() { return alchemistState.mixUsed; },
    get mysteryEvent() { return mysteryEvent; },
    get activeRunData() { return hasActiveBattle ? { characterId: run.characterId } : null; },
    handCardRefs, battleSceneRef, playerPanelRef, enemyPanelRef, destinationButtonRefs,
    cardGhosts, shimmerState,
    playerStatusChips, enemyStatusChips, playerCombatTexts, enemyCombatTexts,
    enemyShaking, playerShaking, companionShaking,
    beginRun, handleCharacterSelect, returnToBattle, goToScreen,
    maybeTriggerShimmer, handleCardClick, handleWishChoice, finishRewards,
    handleDestinationChoice, handleCampfireContinue,
    handleShopBuyCard, handleShopRemoveCard, handleShopRefresh, handleShopContinue,
    handleAlchemistBuyCard, handleAlchemistRefresh, handleAlchemistMixPotions, handleAlchemistContinue,
    handleMysteryChoice, handleMysteryRemoveCard, handleMysteryContinue,
    handleActComplete,
    handleEndTurn, handleEndRun,
    skipCombatDevMode, removeCardGhost, resetRunState,
    findCard: (id: string) => cardLibrary.find((c) => c.id === id),
    findTrinket: (id: string) => trinketLibrary.find((t) => t.id === id),
  };
}
