import type { MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { advanceBattleTurnResolved, chooseWishCard, createBattleState, playBattleCardResolved, type BattleState } from "@/lib/battle";
import { cardLibrary, enemyBestiary, starterDeck, type BattleCard } from "@/lib/game-data";
import { destinationPool } from "./config";
import { useCardGhosts, useFloatingCombatTexts, useHandCardDrag, useShimmerController } from "./hooks";
import { animateCardActivation, animateRemainingHandDiscard, isPointerInBattlefield } from "./run-controller-helpers";
import type { Destination, Screen } from "./types";
import { appendUnique, getCardRect, getEnemyStatusChips, getHoverId, getPlayerStatusChips, randomBetween, sampleItems } from "./utils";

type SetStringList = React.Dispatch<React.SetStateAction<string[]>>;

export function useAlchemyRunController({
  setDiscoveredCardIds,
  setEncounteredEnemyIds,
}: {
  setDiscoveredCardIds: SetStringList;
  setEncounteredEnemyIds: SetStringList;
}) {
  const [screen, setScreen] = useState<Screen>("menu");
  const [battleState, setBattleState] = useState<BattleState>(() => createBattleState(starterDeck, 0));
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [handAnimationCycle, setHandAnimationCycle] = useState(0);
  const [hasActiveBattle, setHasActiveBattle] = useState(false);
  const [runDeck, setRunDeck] = useState<BattleCard[]>(() => [...starterDeck]);
  const [runGold, setRunGold] = useState(0);
  const [rewardChoices, setRewardChoices] = useState<BattleCard[]>([]);
  const [rewardGold, setRewardGold] = useState(0);
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null);
  const [destinationOptions, setDestinationOptions] = useState<Destination[]>([]);

  const handCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const animatedHandCycleRef = useRef(-1);
  const battleSceneRef = useRef<HTMLDivElement | null>(null);
  const playerPanelRef = useRef<HTMLDivElement | null>(null);
  const enemyPanelRef = useRef<HTMLDivElement | null>(null);
  const destinationButtonRefs = useRef<Partial<Record<Destination, HTMLButtonElement | null>>>({});
  const { cardGhosts, removeCardGhost, spawnCardGhost } = useCardGhosts();
  const { floatingCombatTexts, showCombatTexts } = useFloatingCombatTexts();
  const { shimmerState, maybeTriggerShimmer: triggerShimmer } = useShimmerController();
  const { activeDraggedCardId, beginCardDrag, dragPreview, shouldIgnoreClick } = useHandCardDrag(handleCardRelease);

  const playerStatusChips = useMemo(() => getPlayerStatusChips(battleState), [battleState]);
  const enemyStatusChips = useMemo(() => getEnemyStatusChips(battleState), [battleState]);
  const playerCombatTexts = useMemo(() => floatingCombatTexts.filter((entry) => entry.target === "player"), [floatingCombatTexts]);
  const enemyCombatTexts = useMemo(() => floatingCombatTexts.filter((entry) => entry.target === "enemy"), [floatingCombatTexts]);

  useEffect(() => {
    if (screen !== "battle") {
      return;
    }

    if (animatedHandCycleRef.current === handAnimationCycle) {
      return;
    }

    animatedHandCycleRef.current = handAnimationCycle;
    const frame = window.requestAnimationFrame(() => {
      battleState.hand.forEach((card, index) => {
        const element = handCardRefs.current[card.id];
        if (!element) {
          return;
        }

        spawnCardGhost({ art: card.art, rect: getCardRect(element.getBoundingClientRect()), rotation: (index - (battleState.hand.length - 1) / 2) * 4.2, delay: index * 55, variant: "draw-in" });
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [battleState.hand, handAnimationCycle, screen, spawnCardGhost]);

  useEffect(() => {
    if (screen !== "battle" || battleState.enemyHealth <= 0 || battleState.playerHealth <= 0 || battleState.wishOptions || (battleState.mana > 0 && battleState.hand.length > 0)) {
      return;
    }

    const timeout = window.setTimeout(() => advanceTurn(), 1220);
    return () => window.clearTimeout(timeout);
  }, [battleState, screen]);

  useEffect(() => {
    if (screen !== "battle" || battleState.enemyHealth > 0) {
      return;
    }

    const foundGold = randomBetween(10, 30);
    setRunGold(battleState.gold + foundGold);
    setRewardGold(foundGold);
    setRewardChoices(sampleItems(cardLibrary, 3));
    setSelectedRewardId(null);
    setDestinationOptions(sampleItems(destinationPool, 3));
    setHasActiveBattle(false);
    setHoveredCardId(null);
    setMenuOpen(false);

    const timeout = window.setTimeout(() => setScreen("rewards"), 680);
    return () => window.clearTimeout(timeout);
  }, [battleState.enemyHealth, battleState.gold, screen]);

  function beginRun() {
    const freshDeck = [...starterDeck];
    setRunDeck(freshDeck);
    setRunGold(0);
    setRewardChoices([]);
    setRewardGold(0);
    setSelectedRewardId(null);
    setDestinationOptions([]);
    setDiscoveredCardIds((current) => Array.from(new Set([...current, ...freshDeck.map((card) => card.id)])));
    setEncounteredEnemyIds([]);
    startBattle(freshDeck, 0);
  }

  function startBattle(deck: BattleCard[] = runDeck, gold: number = runGold) {
    setBattleState(createBattleState(deck, gold));
    setHasActiveBattle(true);
    setHoveredCardId(null);
    setMenuOpen(false);
    setSelectedRewardId(null);
    setScreen("battle");
    setHandAnimationCycle((current) => current + 1);
    setEncounteredEnemyIds((current) => appendUnique(current, enemyBestiary[0].id));
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

  function maybeTriggerShimmer(cardId: string) {
    triggerShimmer(cardId);
  }

  function advanceTurn() {
    if (screen !== "battle" || battleState.wishOptions) {
      return;
    }

    animateRemainingHandDiscard(battleState.hand, handCardRefs, spawnCardGhost);
    const resolution = advanceBattleTurnResolved(battleState);
    setBattleState(resolution.state);
    showCombatTexts(resolution.combatTexts);
    setHoveredCardId(null);
    setHandAnimationCycle((current) => current + 1);
  }

  function handleKeyboardPlay(card: BattleCard, event: MouseEvent<HTMLButtonElement>) {
    if (event.detail === 0 && !shouldIgnoreClick(card.id)) {
      handlePlayCard(card, getCardRect(event.currentTarget.getBoundingClientRect()));
    }
  }

  function handleCardPointerDown(card: BattleCard, event: ReactPointerEvent<HTMLButtonElement>) {
    if (screen === "battle" && battleState.mana >= card.cost && !battleState.wishOptions) {
      setHoveredCardId(null);
      beginCardDrag(card, event);
    }
  }

  function handlePlayCard(card: BattleCard, sourceRect: { x: number; y: number; width: number; height: number }) {
    if (screen !== "battle" || battleState.mana < card.cost || battleState.wishOptions) {
      return;
    }

    const index = battleState.hand.findIndex((candidate) => candidate.id === card.id);
    animateCardActivation(card, sourceRect, (index - (battleState.hand.length - 1) / 2) * 4.2, playerPanelRef, enemyPanelRef, battleSceneRef, spawnCardGhost);
    const resolution = playBattleCardResolved(battleState, card.id);
    setBattleState(resolution.state);
    showCombatTexts(resolution.combatTexts);
    setHoveredCardId((current) => (current === getHoverId("hand", card.id) ? null : current));
  }

  function handleCardRelease(payload: { card: BattleCard; rect: { x: number; y: number; width: number; height: number }; dragged: boolean; pointerX: number; pointerY: number }) {
    if (screen !== "battle" || battleState.mana < payload.card.cost || battleState.wishOptions) {
      return;
    }

    if (!payload.dragged || isPointerInBattlefield(payload.pointerX, payload.pointerY, battleSceneRef)) {
      handlePlayCard(payload.card, payload.rect);
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

  function resetRunState() {
    setBattleState(createBattleState(starterDeck, 0));
    setRunDeck([...starterDeck]);
    setRunGold(0);
    setRewardChoices([]);
    setRewardGold(0);
    setSelectedRewardId(null);
    setDestinationOptions([]);
    setHoveredCardId(null);
    setMenuOpen(false);
    setHasActiveBattle(false);
    setScreen("menu");
  }

  return {
    screen,
    battleState,
    hoveredCardId,
    menuOpen,
    hasActiveBattle,
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
    setHoveredCardId,
    setMenuOpen,
    setSelectedRewardId,
    beginRun,
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
  };
}