import type { MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { chooseWishCard, createBattleState, endPlayerTurn, maxPlayerHealth, playBattleCardResolved, type BattleState } from "@/lib/battle";
import { cardLibrary, characters, starterDeck, type BattleCard, type CharacterGender, type CharacterId, type KeywordId } from "@/lib/game-data";
import { playVictory, playDefeat, playDamage, playBuff, playMusic } from "@/lib/audio";
import { destinationPool, getCurrentEnemy } from "./config";
import { useCardGhosts, useFloatingCombatTexts, useHandCardDrag, useShimmerController } from "./hooks";
import { animateCardActivation, isPointerInBattlefield } from "./run-controller-helpers";
import type { Destination, Screen } from "./types";
import { useTalentState } from "./use-talent-state";
import { useRunState } from "./use-run-state";
import type { TalentXP } from "@/lib/talents";
import type { UnlockedTalents } from "./talent-pool";
import { AUTO_END_TURN_DELAY, CAMPFIRE_HEAL_FRACTION, DESTINATION_CHOICES, ENEMY_PHASE_DELAY, GOLD_REWARD_MAX, GOLD_REWARD_MIN, MUSIC_KEYS, REWARD_CARD_CHOICES, SHAKE_DURATION, SHOP_CARD_PRICE, SHOP_REFRESH_PRICE, SHOP_REMOVE_PRICE, VICTORY_TRANSITION_DELAY } from "@/lib/game-constants";
import { getCardRect, getEnemyStatusChips, getHoverId, getPlayerStatusChips, randomBetween, sampleItems } from "./utils";

type SetStringList = React.Dispatch<React.SetStateAction<string[]>>;

export function useAlchemyRunController({
  setDiscoveredCardIds, setEncounteredEnemyIds,
  initialTalentXP, initialUnlockedTalents, initialActiveRun,
}: {
  setDiscoveredCardIds: SetStringList; setEncounteredEnemyIds: SetStringList;
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
  // Campfire only appears when HP is below 80%. Merchant's Shop only appears when gold >= 50.
  function getAvailableDestinations() {
    return destinationPool.filter((d) => {
      if (d === "Campfire" && run.runPlayerHealth >= Math.floor(maxPlayerHealth * 0.8)) return false;
      if (d === "Merchant's Shop" && run.runGold < 50) return false;
      return true;
    });
  }

  // ============ Reward / Shop State ============
  const [rewardState, setRewardState] = useState<{ choices: BattleCard[]; gold: number; selectedId: string | null; destinations: Destination[] }>({ choices: [], gold: 0, selectedId: null, destinations: [] });
  const [shopState, setShopState] = useState<{ cards: BattleCard[]; refreshesLeft: number; removeUsed: boolean }>({ cards: [], refreshesLeft: 1, removeUsed: false });

  // ============ Refs ============
  const handCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const battleSceneRef = useRef<HTMLDivElement | null>(null);
  const playerPanelRef = useRef<HTMLDivElement | null>(null);
  const enemyPanelRef = useRef<HTMLDivElement | null>(null);
  const destinationButtonRefs = useRef<Partial<Record<Destination, HTMLButtonElement | null>>>({});

  // ============ Hooks ============
  const { cardGhosts, removeCardGhost, clearCardGhosts, spawnCardGhost } = useCardGhosts();
  const { floatingCombatTexts, showCombatTexts } = useFloatingCombatTexts();
  const { shimmerState, maybeTriggerShimmer } = useShimmerController();
  const { activeDraggedCardId, beginCardDrag, dragPreview, shouldIgnoreClick } = useHandCardDrag(handleCardRelease);

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
    const gold = randomBetween(GOLD_REWARD_MIN, GOLD_REWARD_MAX);
    run.setRunPlayerHealth(battleState.playerHealth);
    run.setRunGold(battleState.gold + gold);
    setRewardState({ choices: sampleItems(cardLibrary, REWARD_CARD_CHOICES), gold: gold, selectedId: null, destinations: sampleItems(getAvailableDestinations(), DESTINATION_CHOICES) });
    setHasActiveBattle(false); setHoveredCardId(null); setMenuOpen(false); playVictory();
    const t = setTimeout(() => setScreen("rewards"), VICTORY_TRANSITION_DELAY);
    return () => clearTimeout(t);
  }, [battleState.enemyHealth, battleState.gold, screen]);

  // ============ Game Flow ============
  function beginRun() { if (hasActiveBattle) { returnToBattle(); return; } playMusic(MUSIC_KEYS.MENU); setScreen("character-select"); }

  function handleCharacterSelect(selectedId: CharacterId, gender: CharacterGender) {
    const character = characters[selectedId];
    const freshDeck = [...character.startingDeck];
    run.setCharacter(selectedId, gender);
    run.setRunDeck(freshDeck);
    run.setRunGold(0);
    run.setRoomsEncountered(0);
    run.setRunPlayerHealth(maxPlayerHealth);
    setRewardState({ choices: [], gold: 0, selectedId: null, destinations: [] });
    setDiscoveredCardIds((current) => Array.from(new Set([...current, ...freshDeck.map((c) => c.id)])));
    setEncounteredEnemyIds([]);
    playMusic(selectedId);
    startBattle(freshDeck, 0);
  }

  function startBattle(deck: BattleCard[] = run.runDeck, gold: number = run.runGold) {
    const enemy = getCurrentEnemy(run.roomsEncountered);
    run.setRoomsEncountered((p) => p + 1);
    clearCardGhosts();
    setBattleState(createBattleState(deck, gold, run.roomsEncountered, enemy, run.runPlayerHealth, talents.talentEffects));
    setHasActiveBattle(true); setHoveredCardId(null); setMenuOpen(false); setRewardState((p) => ({ ...p, selectedId: null })); setScreen("battle");
    setEncounteredEnemyIds((current) => current.includes(enemy.id) ? current : [...current, enemy.id]);
  }

  function returnToBattle() { if (hasActiveBattle) { setMenuOpen(false); setScreen("battle"); } }
  function goToScreen(nextScreen: Screen) { setHoveredCardId(null); setMenuOpen(false); setScreen(nextScreen); }

  // ============ Card Play ============
  function handleKeyboardPlay(card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) {
    if (event.detail === 0 && !shouldIgnoreClick(card.id)) handlePlayCard(card, index, getCardRect(event.currentTarget.getBoundingClientRect()));
  }

  function handleCardPointerDown(card: BattleCard, index: number, event: ReactPointerEvent<HTMLButtonElement>) {
    if (screen === "battle" && battleState.mana >= card.cost && !battleState.wishOptions) { setHoveredCardId(null); beginCardDrag(card, index, event); }
  }

  function handlePlayCard(card: BattleCard, index: number, sourceRect: { x: number; y: number; width: number; height: number }) {
    if (screen !== "battle" || battleState.mana < card.cost || battleState.wishOptions || battleState.turnPhase !== "player") return;
    animateCardActivation(card, sourceRect, (index - (battleState.hand.length - 1) / 2) * 4.2, playerPanelRef, enemyPanelRef, battleSceneRef, spawnCardGhost);
    const resolution = playBattleCardResolved(battleState, card.id, index);
    if (resolution.combatTexts.some((ct) => ct.kind === "damage" && ct.target === "enemy")) { playDamage(); setEnemyShaking(true); setTimeout(() => setEnemyShaking(false), SHAKE_DURATION); }
    if (resolution.combatTexts.some((ct) => ct.kind === "heal" && ct.target === "player")) playBuff();
    if (resolution.combatTexts.some((ct) => ct.kind === "status" && ct.target === "player")) playBuff();
    setBattleState(resolution.state);
    showCombatTexts(resolution.combatTexts);
    setHoveredCardId((current) => (current === getHoverId("hand", `${card.id}-${index}`) ? null : current));
    talents.awardCardXP(card);
  }

  function handleCardRelease(payload: { card: BattleCard; index: number; rect: { x: number; y: number; width: number; height: number }; dragged: boolean; pointerX: number; pointerY: number }) {
    if (screen !== "battle" || battleState.mana < payload.card.cost || battleState.wishOptions) return;
    if (!payload.dragged || isPointerInBattlefield(payload.pointerX, payload.pointerY, battleSceneRef)) handlePlayCard(payload.card, payload.index, payload.rect);
  }

  function handleWishChoice(card: BattleCard) {
    setBattleState((current) => chooseWishCard(current, card.id));
    setDiscoveredCardIds((current) => current.includes(card.id) ? current : [...current, card.id]);
  }

  // ============ Rewards & Destinations ============
  function finishRewards(chosenCard?: BattleCard) {
    if (chosenCard) { run.setRunDeck((prev) => [...prev, chosenCard]); setDiscoveredCardIds((cur) => cur.includes(chosenCard.id) ? cur : [...cur, chosenCard.id]); }
    setRewardState((prev) => ({ choices: [], gold: 0, selectedId: null, destinations: prev.destinations }));
    setHoveredCardId(null); setScreen("destination");
  }

  function handleDestinationChoice(destination: Destination) {
    setHoveredCardId(null); setMenuOpen(false);
    if (destination === "Campfire") setScreen("campfire");
    else if (destination === "Merchant's Shop") { setShopState({ cards: sampleItems(cardLibrary, 3), refreshesLeft: 1, removeUsed: false }); setScreen("shop"); }
    else startBattle();
  }

  function handleShopBuyCard(card: BattleCard) {
    if (run.runGold < SHOP_CARD_PRICE) return;
    run.setRunGold((p) => p - SHOP_CARD_PRICE); run.setRunDeck((p) => [...p, card]);
    setDiscoveredCardIds((cur) => cur.includes(card.id) ? cur : [...cur, card.id]);
  }

  function handleShopRemoveCard(index: number) {
    if (run.runGold < SHOP_REMOVE_PRICE) return;
    run.setRunGold((p) => p - SHOP_REMOVE_PRICE); run.setRunDeck((p) => p.filter((_, i) => i !== index));
    setShopState((p) => ({ ...p, removeUsed: true }));
  }

  function handleShopRefresh() {
    setShopState((p) => {
      if (p.refreshesLeft <= 0 || run.runGold < SHOP_REFRESH_PRICE) return p;
      run.setRunGold((g) => g - SHOP_REFRESH_PRICE);
      return { ...p, cards: sampleItems(cardLibrary, 3), refreshesLeft: 0 };
    });
  }

  function handleShopContinue() {
    run.setRoomsEncountered((p) => p + 1);
    setRewardState((prev) => ({ ...prev, destinations: sampleItems(getAvailableDestinations(), DESTINATION_CHOICES) }));
    setHoveredCardId(null); setMenuOpen(false); setScreen("destination");
  }

  function handleCampfireContinue() {
    run.setRunPlayerHealth((prev) => Math.min(maxPlayerHealth, prev + Math.floor(maxPlayerHealth * CAMPFIRE_HEAL_FRACTION)));
    run.setRoomsEncountered((p) => p + 1);
    setRewardState((prev) => ({ ...prev, destinations: sampleItems(getAvailableDestinations(), DESTINATION_CHOICES) }));
    setHoveredCardId(null); setMenuOpen(false); setScreen("destination");
  }

  // ============ Turn Management ============
  function handleEndTurn() {
    if (screen !== "battle" || battleState.turnPhase !== "player" || battleState.wishOptions) return;
    const result = endPlayerTurn(battleState);
    setBattleState({ ...result.state, turnPhase: "enemy", hand: [], playerHealth: battleState.playerHealth, playerStatuses: battleState.playerStatuses });
    const dotTexts = result.combatTexts.filter((ct) => ct.target === "enemy");
    if (dotTexts.length > 0) showCombatTexts(dotTexts);
    if (result.state.enemyHealth <= 0) return;
    const playerTexts = result.combatTexts.filter((ct) => ct.target === "player");
    setTimeout(() => {
      playDamage(); setBattleState(result.state);
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
    setHoveredCardId(null); setMenuOpen(false); setHasActiveBattle(false); setScreen("menu");
  }

  function clearPermanentData() { talents.clearPermanentData(); }

  // ============ Return ============
  return {
    screen, battleState, hoveredCardId, menuOpen, hasActiveBattle,
    roomsEncountered: run.roomsEncountered,
    get rewardChoices() { return rewardState.choices; }, get rewardGold() { return rewardState.gold; },
    get selectedRewardId() { return rewardState.selectedId; }, get destinationOptions() { return rewardState.destinations; },
    get shopCards() { return shopState.cards; }, get shopRefreshesLeft() { return shopState.refreshesLeft; }, get shopRemoveUsed() { return shopState.removeUsed; },
    setRewardState,
    runDeck: run.runDeck, runGold: run.runGold, runPlayerHealth: run.runPlayerHealth,
    handCardRefs, battleSceneRef, playerPanelRef, enemyPanelRef, destinationButtonRefs,
    cardGhosts, shimmerState, dragPreview, activeDraggedCardId,
    playerStatusChips, enemyStatusChips, playerCombatTexts, enemyCombatTexts,
    enemyShaking, playerShaking,
    talentXP: talents.talentXP, runTalentXP: talents.runTalentXP, unlockedTalents: talents.unlockedTalents,
    unlockTalent: talents.unlockTalent, resetUnlockedTalents: talents.resetUnlockedTalents,
    setHoveredCardId, setMenuOpen, setSelectedRewardId: (id: string | null) => setRewardState((p) => ({ ...p, selectedId: id })),
    characterId: run.characterId, characterGender: run.characterGender,
    beginRun, handleCharacterSelect, returnToBattle, goToScreen,
    maybeTriggerShimmer, handleKeyboardPlay, handleCardPointerDown,
    handleWishChoice, finishRewards, handleDestinationChoice, handleCampfireContinue,
    handleShopBuyCard, handleShopRemoveCard, handleShopRefresh, handleShopContinue,
    skipCombatDevMode, removeCardGhost, resetRunState, clearPermanentData,
    handleEndTurn, handleEndRun,
    get activeRunData() { return hasActiveBattle ? { characterId: run.characterId, characterGender: run.characterGender } : null; },
  };
}
