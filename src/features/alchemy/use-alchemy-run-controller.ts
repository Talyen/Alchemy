import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { chooseWishCard, createBattleState, endPlayerTurn, maxPlayerHealth, playBattleCardResolved, cardHasDamageType, type BattleState } from "@/lib/battle";
import { cardLibrary, characters, starterDeck, type BattleCard, type CharacterGender, type CharacterId, type KeywordId } from "@/lib/game-data";
import { playVictory, playDefeat, playCardSound, playEnemyAttack } from "@/lib/audio";
import { destinationPool, getCurrentEnemy } from "./config";
import { useCardGhosts, useFloatingCombatTexts, useShimmerController } from "./hooks";
import { animateCardActivation } from "./run-controller-helpers";
import type { Destination, Screen } from "./types";
import { useTalentState } from "./use-talent-state";
import { useRunState } from "./use-run-state";
import type { TalentXP } from "@/lib/talents";
import type { UnlockedTalents } from "./talent-pool";
import { mysteryPool, type MysteryChoice, type MysteryEvent } from "./mystery-events";
import { createMixedPotion, applyMixToDeck } from "./potion-mixer";
import { AUTO_END_TURN_DELAY, ALCHEMIST_MIX_PRICE, ALCHEMIST_POTION_PRICE, ALCHEMIST_REFRESH_PRICE, CAMPFIRE_HEAL_FRACTION, DESTINATION_CHOICES, ENEMY_PHASE_DELAY, GOLD_REWARD_MAX, GOLD_REWARD_MIN, REWARD_CARD_CHOICES, SHAKE_DURATION, SHOP_CARD_PRICE, SHOP_REFRESH_PRICE, SHOP_REMOVE_PRICE, VICTORY_TRANSITION_DELAY } from "@/lib/game-constants";
import { getCardRect, getEnemyStatusChips, getHoverId, getPlayerStatusChips, randomBetween, resampleItems, sampleItems } from "./utils";

type SetStringList = React.Dispatch<React.SetStateAction<string[]>>;

function getEffectiveCost(state: BattleState, card: BattleCard): number {
  let cost = card.cost;
  if (state.flags.nextCardCostReduction > 0) {
    cost = Math.max(0, cost - state.flags.nextCardCostReduction);
  }
  if (!state.flags.firstPhysicalCardFreeUsed && state.talentEffects.firstPhysicalCardFree && cardHasDamageType(card, "physical")) {
    cost = 0;
  }
  if (!state.flags.firstHolyCardFreeUsed && state.talentEffects.firstHolyCardFree && cardHasDamageType(card, "holy")) {
    cost = 0;
  }
  if (!state.flags.firstPoisonCardFreeUsed && state.talentEffects.firstPoisonCardFree && cardHasDamageType(card, "poison")) {
    cost = 0;
  }
  if (!state.flags.firstBleedCardFreeUsed && state.talentEffects.firstBleedCardFree && cardHasDamageType(card, "bleed")) {
    cost = 0;
  }
  return cost;
}

export function useAlchemyRunController({
  discoveredCardIds, setDiscoveredCardIds, setEncounteredEnemyIds,
  discoveredTrinketIds, setDiscoveredTrinketIds,
  initialTalentXP, initialUnlockedTalents, initialActiveRun,
}: {
  discoveredCardIds: string[];
  setDiscoveredCardIds: SetStringList; setEncounteredEnemyIds: SetStringList;
  discoveredTrinketIds: string[]; setDiscoveredTrinketIds: SetStringList;
  initialTalentXP: TalentXP; initialUnlockedTalents: UnlockedTalents;
  initialActiveRun: { characterId: CharacterId; characterGender: CharacterGender } | null;
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

  // Filters the destination pool based on current game state.
  function getAvailableDestinations(currentHp?: number, currentGold?: number) {
    const hp = currentHp ?? run.runPlayerHealth;
    const gold = currentGold ?? run.runGold;
    return destinationPool.filter((d) => {
      if (d === "Campfire" && hp >= Math.floor(run.runMaxHealth * 0.8)) return false;
      if (d === "Merchant's Shop" && gold < 50) return false;
      return true;
    });
  }

  // ============ Reward / Shop State ============
  const [rewardState, setRewardState] = useState<{ choices: BattleCard[]; gold: number; selectedId: string | null; destinations: Destination[] }>({ choices: [], gold: 0, selectedId: null, destinations: [] });
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

  useEffect(() => () => window.clearTimeout(navTimerRef.current), []);

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
  useEffect(() => {
    if (screen !== "battle" || battleState.enemyHealth <= 0 || battleState.playerHealth <= 0 || battleState.wishOptions || (battleState.mana > 0 && battleState.hand.length > 0)) return;
    const t = setTimeout(() => handleEndTurn(), AUTO_END_TURN_DELAY);
    return () => clearTimeout(t);
  }, [battleState, screen]);

  useEffect(() => {
    if (screen !== "battle" || battleState.playerHealth > 0) return;
    playDefeat(); setHasActiveBattle(false); setHoveredCardId(null); setMenuOpen(false); setScreen("game-over");
  }, [battleState.playerHealth, screen]);

  useEffect(() => {
    if (screen !== "battle" || battleState.enemyHealth > 0) return;
    if (battleState.playerHealth <= 0) return;
    const baseGold = randomBetween(GOLD_REWARD_MIN, GOLD_REWARD_MAX);
    const gold = Math.floor(baseGold * (1 + talents.talentEffects.enemyGoldDropBonus));
    const eliteBonus = battleState.currentEnemy.enemyType === "elite" ? Math.floor(gold * 0.3) : 0;
    const newHp = battleState.playerHealth;
    const newGold = battleState.gold + gold + eliteBonus + talents.talentEffects.goldPerCombat;
    run.setRunPlayerHealth(newHp);
    run.setRunGold(newGold);
    if (talents.talentEffects.maxHealthPerCombat > 0) {
      run.setRunMaxHealth((p) => p + talents.talentEffects.maxHealthPerCombat);
    }
    setRewardState({ choices: sampleItems(cardLibrary.filter((c) => c.id !== "mixed-potion"), REWARD_CARD_CHOICES), gold: gold + eliteBonus + talents.talentEffects.goldPerCombat, selectedId: null, destinations: sampleItems(getAvailableDestinations(newHp, newGold), DESTINATION_CHOICES) });
    setHasActiveBattle(false); setHoveredCardId(null); setMenuOpen(false); playVictory();
    const t = setTimeout(() => setScreen("rewards"), VICTORY_TRANSITION_DELAY);
    return () => clearTimeout(t);
  }, [battleState.enemyHealth, battleState.gold, screen]);

  // ============ Game Flow ============
  function beginRun() { if (hasActiveBattle) { returnToBattle(); return; } navigateTo("character-select"); }

  function handleCharacterSelect(selectedId: CharacterId, gender: CharacterGender) {
    const character = characters[selectedId];
    const freshDeck = [...character.startingDeck];
    run.setCharacter(selectedId, gender);
    run.setRunDeck(freshDeck);
    run.setRunGold(talents.talentEffects.startGold);
    run.setRoomsEncountered(0);
    run.setRunPlayerHealth(maxPlayerHealth);
    run.setRunMaxHealth(maxPlayerHealth);
    setRewardState({ choices: [], gold: 0, selectedId: null, destinations: [] });
    setDiscoveredCardIds((current) => Array.from(new Set([...current, ...freshDeck.map((c) => c.id)])));
    setEncounteredEnemyIds([]);
    startBattle(freshDeck, talents.talentEffects.startGold);
  }

  function startBattle(deck: BattleCard[] = run.runDeck, gold: number = run.runGold, enemyType: "normal" | "elite" = "normal") {
    const enemy = getCurrentEnemy(run.roomsEncountered, enemyType);
    run.setRoomsEncountered((p) => p + 1);
    clearCardGhosts();
    setBattleState(createBattleState(deck, gold, run.roomsEncountered, enemy, run.runPlayerHealth, talents.talentEffects, discoveredCardIds, run.runMaxHealth, run.runTrinkets));
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
    if (resolution.combatTexts.some((ct) => ct.kind === "damage" && ct.target === "enemy")) { setEnemyShaking(true); setTimeout(() => setEnemyShaking(false), SHAKE_DURATION); }
    setBattleState(resolution.state);
    showCombatTexts(resolution.combatTexts);
    setHoveredCardId((current) => (current === getHoverId("hand", `${card.id}-${index}`) ? null : current));
    talents.awardCardXP(card);
    cardPlayInProgressRef.current = false;
  }

  function handleWishChoice(card: BattleCard) {
    setBattleState((current) => chooseWishCard(current, card.id));
    setDiscoveredCardIds((current) => current.includes(card.id) ? current : [...current, card.id]);
  }

  // ============ Rewards & Destinations ============
  function finishRewards(chosenCard?: BattleCard) {
    if (chosenCard) { run.setRunDeck((prev) => [...prev, chosenCard]); setDiscoveredCardIds((cur) => cur.includes(chosenCard.id) ? cur : [...cur, chosenCard.id]); }
    setRewardState((prev) => ({ choices: [], gold: 0, selectedId: null, destinations: prev.destinations }));
    setHoveredCardId(null); navigateTo("destination");
  }

  function handleDestinationChoice(destination: Destination) {
    setHoveredCardId(null); setMenuOpen(false);
    if (destination === "Campfire") navigateTo("campfire");
    else if (destination === "Merchant's Shop") { setShopState({ cards: sampleItems(cardLibrary, 3), refreshesLeft: 1, removeUsed: false, firstPurchaseUsed: false }); navigateTo("shop"); }
    else if (destination === "Alchemist's Shop") { const potions = sampleItems(cardLibrary.filter((c) => c.id.includes("potion") && c.id !== "mixed-potion"), 3); setAlchemistState({ potions, refreshesLeft: 1, mixUsed: false, firstPurchaseUsed: false }); navigateTo("alchemist"); }
    else if (destination === "Mystery") { setMysteryEvent(mysteryPool[Math.floor(Math.random() * mysteryPool.length)]); navigateTo("mystery"); }
    else if (destination === "Elite Combat") startBattle(undefined, undefined, "elite");
    else startBattle(undefined, undefined, "normal");
  }

  function handleShopBuyCard(card: BattleCard) {
    let price = Math.max(0, SHOP_CARD_PRICE - talents.talentEffects.shopCardDiscount);
    if (!shopState.firstPurchaseUsed && run.runTrinkets.includes("merchants-favor")) {
      price = Math.max(0, price - 7);
    }
    if (run.runGold < price) return;
    run.setRunGold((p) => Math.max(0, p - price)); run.setRunDeck((p) => [...p, card]);
    setDiscoveredCardIds((cur) => cur.includes(card.id) ? cur : [...cur, card.id]);
    setShopState((p) => ({ ...p, firstPurchaseUsed: true }));
  }

  function handleShopRemoveCard(index: number) {
    const price = Math.max(0, SHOP_REMOVE_PRICE - talents.talentEffects.removeCardDiscount);
    if (run.runGold < price) return;
    run.setRunGold((p) => Math.max(0, p - price)); run.setRunDeck((p) => p.filter((_, i) => i !== index));
    setShopState((p) => ({ ...p, removeUsed: true }));
  }

  function handleShopRefresh() {
    const price = talents.talentEffects.shopFreeRefresh && shopState.refreshesLeft > 0 ? 0 : SHOP_REFRESH_PRICE;
    setShopState((p) => {
      if (p.refreshesLeft <= 0 || run.runGold < price) return p;
      run.setRunGold((g) => Math.max(0, g - price));
      return { ...p, cards: resampleItems(cardLibrary, p.cards, 3), refreshesLeft: 0 };
    });
  }

  function handleShopContinue() {
    run.setRoomsEncountered((p) => p + 1);
    setRewardState((prev) => ({ ...prev, destinations: sampleItems(getAvailableDestinations(), DESTINATION_CHOICES) }));
    setHoveredCardId(null); setMenuOpen(false); navigateTo("destination");
  }

  function handleCampfireContinue() {
    const healFraction = CAMPFIRE_HEAL_FRACTION + talents.talentEffects.campfireHealBonus;
    run.setRunPlayerHealth((prev) => Math.min(run.runMaxHealth, prev + Math.floor(run.runMaxHealth * healFraction)));
    run.setRoomsEncountered((p) => p + 1);
    setRewardState((prev) => ({ ...prev, destinations: sampleItems(getAvailableDestinations(), DESTINATION_CHOICES) }));
    setHoveredCardId(null); setMenuOpen(false); navigateTo("destination");
  }

  function handleAlchemistRefresh() {
    const potionPool = cardLibrary.filter((c) => c.id.includes("potion") && c.id !== "mixed-potion");
    setAlchemistState((p) => {
      if (p.refreshesLeft <= 0 || run.runGold < ALCHEMIST_REFRESH_PRICE) return p;
      run.setRunGold((g) => Math.max(0, g - ALCHEMIST_REFRESH_PRICE));
      return { ...p, potions: resampleItems(potionPool, p.potions, 3), refreshesLeft: 0 };
    });
  }

  function handleAlchemistBuyCard(card: BattleCard) {
    let price = Math.max(0, ALCHEMIST_POTION_PRICE - talents.talentEffects.potionDiscount);
    if (!alchemistState.firstPurchaseUsed && run.runTrinkets.includes("merchants-favor")) {
      price = Math.max(0, price - 7);
    }
    if (run.runGold < price) return;
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

    run.setRunGold((p) => Math.max(0, p - price));
    run.setRunDeck((p) => applyMixToDeck(p, indexA, indexB, mixed));
    setAlchemistState((p) => ({ ...p, mixUsed: true }));
    setDiscoveredCardIds((cur) => cur.includes("mixed-potion") ? cur : [...cur, "mixed-potion"]);
  }

  function handleAlchemistContinue() {
    run.setRoomsEncountered((p) => p + 1);
    setRewardState((prev) => ({ ...prev, destinations: sampleItems(getAvailableDestinations(), DESTINATION_CHOICES) }));
    setHoveredCardId(null); setMenuOpen(false); navigateTo("destination");
  }

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
          run.setRunGold((p) => p + effect.amount);
          break;
        case "loseGold":
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
        case "none":
          break;
      }
    }
  }

  function handleMysteryRemoveCard(index: number) {
    run.setRunDeck((p) => p.filter((_, i) => i !== index));
  }

  function handleMysteryContinue() {
    run.setRoomsEncountered((p) => p + 1);
    setRewardState((prev) => ({ ...prev, destinations: sampleItems(getAvailableDestinations(), DESTINATION_CHOICES) }));
    setHoveredCardId(null); setMenuOpen(false); navigateTo("destination");
  }

  // ============ Turn Management ============
  function handleEndTurn() {
    if (screen !== "battle" || battleState.turnPhase !== "player" || battleState.wishOptions || cardPlayInProgressRef.current) return;
    const result = endPlayerTurn(battleState);
    setBattleState({ ...result.state, turnPhase: "enemy", hand: [], playerHealth: battleState.playerHealth, playerStatuses: battleState.playerStatuses });
    const dotTexts = result.combatTexts.filter((ct) => ct.target === "enemy");
    if (dotTexts.length > 0) showCombatTexts(dotTexts);
    if (result.state.enemyHealth <= 0) return;
    const playerTexts = result.combatTexts.filter((ct) => ct.target === "player");
    setTimeout(() => {
      playEnemyAttack(battleState.currentEnemy.id);
      setBattleState(result.state);
      if (playerTexts.length > 0) showCombatTexts(playerTexts);
      if (playerTexts.some((ct) => ct.kind === "damage")) { setPlayerShaking(true); setTimeout(() => setPlayerShaking(false), SHAKE_DURATION); }
    }, ENEMY_PHASE_DELAY);
  }

  function handleEndRun() { if (screen !== "battle") return; setBattleState((c) => ({ ...c, playerHealth: 0 })); }
  function skipCombatDevMode() { if (screen === "battle") { setMenuOpen(false); setBattleState((c) => ({ ...c, enemyHealth: 0, wishOptions: null })); } }

  // ============ State Reset ============
  function resetRunState() {
    clearCardGhosts(); setBattleState(createBattleState(starterDeck, 0));
    run.reset(); talents.resetRunXP();
    setRewardState({ choices: [], gold: 0, selectedId: null, destinations: [] });
    setHoveredCardId(null); setMenuOpen(false); setHasActiveBattle(false); navigateTo("menu");
  }

  function clearPermanentData() { talents.clearPermanentData(); }

  // ============ Return ============
  return {
    screen, battleState, hoveredCardId, menuOpen, hasActiveBattle,
    roomsEncountered: run.roomsEncountered,
    get rewardChoices() { return rewardState.choices; }, get rewardGold() { return rewardState.gold; },
    get selectedRewardId() { return rewardState.selectedId; }, get destinationOptions() { return rewardState.destinations; },
    get shopCards() { return shopState.cards; }, get shopRefreshesLeft() { return shopState.refreshesLeft; }, get shopRemoveUsed() { return shopState.removeUsed; },
    get alchemistPotions() { return alchemistState.potions; }, get alchemistRefreshesLeft() { return alchemistState.refreshesLeft; }, get alchemistMixUsed() { return alchemistState.mixUsed; },
    setRewardState,
    runDeck: run.runDeck, runGold: run.runGold, runPlayerHealth: run.runPlayerHealth, runMaxHealth: run.runMaxHealth,
    runTrinkets: run.runTrinkets,
    handCardRefs, battleSceneRef, playerPanelRef, enemyPanelRef, destinationButtonRefs,
    cardGhosts, shimmerState,
    playerStatusChips, enemyStatusChips, playerCombatTexts, enemyCombatTexts,
    enemyShaking, playerShaking,
    talentXP: talents.talentXP, runTalentXP: talents.runTalentXP, unlockedTalents: talents.unlockedTalents,
    unlockTalent: talents.unlockTalent, unlockAllTalents: talents.unlockAllTalents, resetUnlockedTalents: talents.resetUnlockedTalents,
    setHoveredCardId, setMenuOpen, setSelectedRewardId: (id: string | null) => setRewardState((p) => ({ ...p, selectedId: id })),
    characterId: run.characterId, characterGender: run.characterGender,
    beginRun, handleCharacterSelect, returnToBattle, goToScreen,
    maybeTriggerShimmer, handleCardClick,
    handleWishChoice, finishRewards, handleDestinationChoice, handleCampfireContinue,
    handleShopBuyCard, handleShopRemoveCard, handleShopRefresh, handleShopContinue,
    handleAlchemistBuyCard, handleAlchemistRefresh, handleAlchemistMixPotions, handleAlchemistContinue,
    get mysteryEvent() { return mysteryEvent; },
    handleMysteryChoice, handleMysteryRemoveCard, handleMysteryContinue,
    skipCombatDevMode, removeCardGhost, resetRunState, clearPermanentData,
    handleEndTurn, handleEndRun,
    get activeRunData() { return hasActiveBattle ? { characterId: run.characterId, characterGender: run.characterGender } : null; },
    findCard: (id: string) => cardLibrary.find((c) => c.id === id),
  };
}
