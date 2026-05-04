import type { MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { chooseWishCard, createBattleState, endPlayerTurn, maxPlayerHealth, playBattleCardResolved, type BattleState } from "@/lib/battle";
import { cardLibrary, characters, starterDeck, type BattleCard, type CharacterGender, type CharacterId, type KeywordId } from "@/lib/game-data";
import { playVictory, playDefeat, playEnemyAttack, initAudio, playDamage, playBuff, playMusic } from "@/lib/audio";
import { addTalentXP, extractCardKeywords, type TalentXP } from "@/lib/talents";
import { destinationPool, getCurrentEnemy } from "./config";
import { useCardGhosts, useFloatingCombatTexts, useHandCardDrag, useShimmerController } from "./hooks";
import { animateCardActivation, isPointerInBattlefield } from "./run-controller-helpers";
import type { Destination, Screen } from "./types";
import type { UnlockedTalents } from "./talent-pool";
import { computeTalentEffects } from "./talent-pool";
import { appendUnique, getCardRect, getEnemyStatusChips, getHoverId, getPlayerStatusChips, randomBetween, sampleItems } from "./utils";

type SetStringList = React.Dispatch<React.SetStateAction<string[]>>;

export function useAlchemyRunController({
  setDiscoveredCardIds,
  setEncounteredEnemyIds,
  initialTalentXP,
  initialUnlockedTalents,
  initialActiveRun,
}: {
  setDiscoveredCardIds: SetStringList;
  setEncounteredEnemyIds: SetStringList;
  initialTalentXP: TalentXP;
  initialUnlockedTalents: UnlockedTalents;
  initialActiveRun: { characterId: CharacterId; characterGender: CharacterGender } | null;
}) {
  const [screen, setScreen] = useState<Screen>("menu");
  const [battleState, setBattleState] = useState<BattleState>(() => createBattleState(starterDeck, 0));
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hasActiveBattle, setHasActiveBattle] = useState(initialActiveRun !== null);
  const [runDeck, setRunDeck] = useState<BattleCard[]>(() => initialActiveRun ? [...characters[initialActiveRun.characterId].startingDeck] : [...starterDeck]);
  const [runGold, setRunGold] = useState(0);
  const [talentXP, setTalentXP] = useState<TalentXP>(initialTalentXP);
  const [runTalentXP, setRunTalentXP] = useState<TalentXP>({});
  const [unlockedTalents, setUnlockedTalents] = useState<UnlockedTalents>(initialUnlockedTalents);
  const [rewardChoices, setRewardChoices] = useState<BattleCard[]>([]);
  const [rewardGold, setRewardGold] = useState(0);
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null);
  const [destinationOptions, setDestinationOptions] = useState<Destination[]>([]);
  const [roomsEncountered, setRoomsEncountered] = useState(0);
  const [runPlayerHealth, setRunPlayerHealth] = useState(maxPlayerHealth);
  const [enemyShaking, setEnemyShaking] = useState(false);
  const [playerShaking, setPlayerShaking] = useState(false);
  const [characterId, setCharacterId] = useState<CharacterId>("knight");
  const [characterGender, setCharacterGender] = useState<CharacterGender>("female");

  const handCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const battleSceneRef = useRef<HTMLDivElement | null>(null);
  const playerPanelRef = useRef<HTMLDivElement | null>(null);
  const enemyPanelRef = useRef<HTMLDivElement | null>(null);
  const destinationButtonRefs = useRef<Partial<Record<Destination, HTMLButtonElement | null>>>({});
  const { cardGhosts, removeCardGhost, clearCardGhosts, spawnCardGhost } = useCardGhosts();
  const { floatingCombatTexts, showCombatTexts } = useFloatingCombatTexts();
  const { shimmerState, maybeTriggerShimmer } = useShimmerController();
  const { activeDraggedCardId, beginCardDrag, dragPreview, shouldIgnoreClick } = useHandCardDrag(handleCardRelease);

  const playerStatusChips = useMemo(() => getPlayerStatusChips(battleState), [battleState]);
  const enemyStatusChips = useMemo(() => getEnemyStatusChips(battleState), [battleState]);
  const playerCombatTexts = useMemo(() => floatingCombatTexts.filter((entry) => entry.target === "player"), [floatingCombatTexts]);
  const enemyCombatTexts = useMemo(() => floatingCombatTexts.filter((entry) => entry.target === "enemy"), [floatingCombatTexts]);

  useEffect(() => {
    initAudio();
  }, []);

  useEffect(() => {
    if (screen !== "battle" || battleState.enemyHealth <= 0 || battleState.playerHealth <= 0 || battleState.wishOptions || (battleState.mana > 0 && battleState.hand.length > 0)) {
      return;
    }

    const timeout = window.setTimeout(() => handleEndTurn(), 1220);
    return () => window.clearTimeout(timeout);
  }, [battleState, screen]);

  useEffect(() => {
    if (screen !== "battle" || battleState.playerHealth > 0) {
      return;
    }

    playDefeat();
    setHasActiveBattle(false);
    setHoveredCardId(null);
    setMenuOpen(false);
    setScreen("game-over");
  }, [battleState.playerHealth, screen]);

  useEffect(() => {
    if (screen !== "battle" || battleState.enemyHealth > 0) {
      return;
    }

    if (battleState.playerHealth <= 0) {
      return;
    }

    const foundGold = randomBetween(10, 30);
    setRunPlayerHealth(battleState.playerHealth);
    setRunGold(battleState.gold + foundGold);
    setRewardGold(foundGold);
    setRewardChoices(sampleItems(cardLibrary, 3));
    setSelectedRewardId(null);
    setDestinationOptions(sampleItems(destinationPool, 3));
    setHasActiveBattle(false);
    setHoveredCardId(null);
    setMenuOpen(false);
    playVictory();

    const timeout = window.setTimeout(() => setScreen("rewards"), 1200);
    return () => window.clearTimeout(timeout);
  }, [battleState.enemyHealth, battleState.gold, screen]);

  function beginRun() {
    if (hasActiveBattle) {
      returnToBattle();
      return;
    }
    playMusic("menu");
    setScreen("character-select");
  }

  function handleCharacterSelect(selectedId: CharacterId, gender: CharacterGender) {
    const character = characters[selectedId];
    const freshDeck = [...character.startingDeck];
    setCharacterId(selectedId);
    setCharacterGender(gender);
    setRunDeck(freshDeck);
    setRunGold(0);
    setRoomsEncountered(0);
    setRunPlayerHealth(maxPlayerHealth);
    setRewardChoices([]);
    setRewardGold(0);
    setSelectedRewardId(null);
    setDestinationOptions([]);
    setDiscoveredCardIds((current) => Array.from(new Set([...current, ...freshDeck.map((card) => card.id)])));
    setEncounteredEnemyIds([]);
    playMusic(selectedId);
    startBattle(freshDeck, 0);
  }

  function startBattle(deck: BattleCard[] = runDeck, gold: number = runGold) {
    const currentEnemy = getCurrentEnemy(roomsEncountered);
    const nextRooms = roomsEncountered + 1;
    setRoomsEncountered(nextRooms);
    clearCardGhosts();
    const talentEffects = computeTalentEffects(unlockedTalents);
    setBattleState(createBattleState(deck, gold, nextRooms, currentEnemy, runPlayerHealth, talentEffects));
    setHasActiveBattle(true);
    setHoveredCardId(null);
    setMenuOpen(false);
    setSelectedRewardId(null);
    setScreen("battle");
    setEncounteredEnemyIds((current) => appendUnique(current, currentEnemy.id));
  }

  function returnToBattle() {
    if (hasActiveBattle) {
      setMenuOpen(false);
      setScreen("battle");
    }
  }

  function goToScreen(nextScreen: Screen) {
    setHoveredCardId(null);
    setMenuOpen(false);
    setScreen(nextScreen);
  }

  function handleKeyboardPlay(card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) {
    if (event.detail === 0 && !shouldIgnoreClick(card.id)) {
      handlePlayCard(card, index, getCardRect(event.currentTarget.getBoundingClientRect()));
    }
  }

  function handleCardPointerDown(card: BattleCard, index: number, event: ReactPointerEvent<HTMLButtonElement>) {
    if (screen === "battle" && battleState.mana >= card.cost && !battleState.wishOptions) {
      setHoveredCardId(null);
      beginCardDrag(card, index, event);
    }
  }

  function handlePlayCard(card: BattleCard, index: number, sourceRect: { x: number; y: number; width: number; height: number }) {
    if (screen !== "battle" || battleState.mana < card.cost || battleState.wishOptions || battleState.turnPhase !== "player") {
      return;
    }

    animateCardActivation(card, sourceRect, (index - (battleState.hand.length - 1) / 2) * 4.2, playerPanelRef, enemyPanelRef, battleSceneRef, spawnCardGhost);
    const resolution = playBattleCardResolved(battleState, card.id, index);

    const damageToEnemy = resolution.combatTexts.some(ct => ct.kind === 'damage' && ct.target === 'enemy');
    const healOnPlayer = resolution.combatTexts.some(ct => ct.kind === 'heal' && ct.target === 'player');
    const buffOnPlayer = resolution.combatTexts.some(ct => ct.kind === 'status' && ct.target === 'player');

    if (damageToEnemy) {
      playDamage();
      setEnemyShaking(true);
      setTimeout(() => setEnemyShaking(false), 420);
    }
    if (healOnPlayer) {
      playBuff();
    }
    if (buffOnPlayer) {
      playBuff();
    }
    
    setBattleState(resolution.state);
    showCombatTexts(resolution.combatTexts);
    setHoveredCardId((current) => (current === getHoverId("hand", `${card.id}-${index}`) ? null : current));

    const cardKeywords = extractCardKeywords(card);
    if (cardKeywords.length > 0) {
      setTalentXP((prev) => addTalentXP(prev, cardKeywords));
      setRunTalentXP((prev) => addTalentXP(prev, cardKeywords));
    }
  }

  function handleCardRelease(payload: { card: BattleCard; index: number; rect: { x: number; y: number; width: number; height: number }; dragged: boolean; pointerX: number; pointerY: number }) {
    if (screen !== "battle" || battleState.mana < payload.card.cost || battleState.wishOptions) {
      return;
    }

    if (!payload.dragged || isPointerInBattlefield(payload.pointerX, payload.pointerY, battleSceneRef)) {
      handlePlayCard(payload.card, payload.index, payload.rect);
    }
  }

  function handleWishChoice(card: BattleCard) {
    setBattleState((current) => chooseWishCard(current, card.id));
    setDiscoveredCardIds((current) => appendUnique(current, card.id));
  }

  function finishRewards(chosenCard?: BattleCard) {
    if (chosenCard) {
      setRunDeck((current) => [...current, chosenCard]);
      setDiscoveredCardIds((current) => appendUnique(current, chosenCard.id));
    }

    setRewardChoices([]);
    setSelectedRewardId(null);
    setHoveredCardId(null);
    setScreen("destination");
  }

  function handleDestinationChoice() {
    startBattle();
  }

function skipCombatDevMode() {
    if (screen === "battle") {
      setMenuOpen(false);
      setBattleState((current) => ({ ...current, enemyHealth: 0, wishOptions: null }));
    }
  }

  function handleEndTurn() {
    if (screen !== "battle" || battleState.turnPhase !== "player" || battleState.wishOptions) {
      return;
    }

    const intermediateState = endPlayerTurn(battleState);
    const enemyPhaseState = {
      ...intermediateState.state,
      turnPhase: "enemy" as const,
      hand: [],
      playerHealth: battleState.playerHealth,
      playerStatuses: battleState.playerStatuses,
    };
    setBattleState(enemyPhaseState);

    const dotTexts = intermediateState.combatTexts.filter(ct => ct.target === 'enemy');
    if (dotTexts.length > 0) {
      showCombatTexts(dotTexts);
    }

    if (intermediateState.state.enemyHealth <= 0) {
      return;
    }

    const playerTexts = intermediateState.combatTexts.filter(ct => ct.target === 'player');

    setTimeout(() => {
      playEnemyAttack();
      setBattleState(intermediateState.state);
      if (playerTexts.length > 0) {
        showCombatTexts(playerTexts);
      }
      const playerTookDamage = playerTexts.some(ct => ct.kind === 'damage');
      if (playerTookDamage) {
        setPlayerShaking(true);
        setTimeout(() => setPlayerShaking(false), 420);
      }
    }, 1800);
  }

  function handleEndRun() {
    if (screen !== "battle") return;
    setBattleState((current) => ({ ...current, playerHealth: 0 }));
  }

  function unlockTalent(keywordId: KeywordId, talentId: string) {
    setUnlockedTalents((prev) => ({
      ...prev,
      [keywordId]: [...(prev[keywordId] ?? []), talentId],
    }));
  }

  function resetUnlockedTalents() {
    setUnlockedTalents({});
  }

  function resetRunState() {
    clearCardGhosts();
    setBattleState(createBattleState(starterDeck, 0));
    setRunDeck([...starterDeck]);
    setRunGold(0);
    setRunTalentXP({});
    setRoomsEncountered(0);
    setRewardChoices([]);
    setRewardGold(0);
    setSelectedRewardId(null);
    setDestinationOptions([]);
    setHoveredCardId(null);
    setMenuOpen(false);
    setHasActiveBattle(false);
    setScreen("menu");
  }

  function clearPermanentData() {
    setTalentXP({});
    setRunTalentXP({});
    setUnlockedTalents({});
  }

  return {
    screen,
    battleState,
    hoveredCardId,
    menuOpen,
    hasActiveBattle,
    roomsEncountered,
    rewardChoices,
    rewardGold,
    selectedRewardId,
    destinationOptions,
    handCardRefs,
    battleSceneRef,
    playerPanelRef,
    enemyPanelRef,
    destinationButtonRefs,
    cardGhosts,
    shimmerState,
    dragPreview,
    activeDraggedCardId,
    playerStatusChips,
    enemyStatusChips,
    playerCombatTexts,
    enemyCombatTexts,
    enemyShaking,
    playerShaking,
    talentXP,
    runTalentXP,
    unlockedTalents,
    unlockTalent,
    resetUnlockedTalents,
    setHoveredCardId,
    setMenuOpen,
    setSelectedRewardId,
    characterId,
    characterGender,
    beginRun,
    handleCharacterSelect,
    returnToBattle,
    goToScreen,
    maybeTriggerShimmer,
    handleKeyboardPlay,
    handleCardPointerDown,
    handleWishChoice,
    finishRewards,
    handleDestinationChoice,
    skipCombatDevMode,
    removeCardGhost,
    resetRunState,
    clearPermanentData,
    handleEndTurn,
    handleEndRun,
    get activeRunData() { return hasActiveBattle ? { characterId, characterGender } : null; },
  };
}