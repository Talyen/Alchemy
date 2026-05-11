import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  chooseWishCard, createBattleState, endPlayerTurn,
  getEffectiveCost, playBattleCardResolved, processCompanionTurnStart,
  type BattleState, type CombatTextEvent,
} from "@/lib/battle";
import { starterDeck, type BattleCard } from "@/lib/game-data";
import { playCardSound, playEnemyAttack, playGoldGain } from "@/lib/audio";
import { getCurrentEnemy, getBossEnemy } from "./config";
import { useCardGhosts, useFloatingCombatTexts, useShimmerController } from "./hooks";
import { animateCardActivation } from "./run-controller-helpers";
import type { Screen } from "./types";
import { computeTrinketManifest } from "@/lib/trinkets";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import { AUTO_END_TURN_DELAY, COMPANION_ATTACK_DELAY, ENEMY_PHASE_DELAY, SHAKE_DURATION } from "@/lib/game-constants";
import { getCardRect, getEnemyStatusChips, getHoverId, getPlayerStatusChips } from "./utils";
import type { useRunState } from "./use-run-state";
import type { useTalentState } from "./use-talent-state";

export function useBattleController({
  run, talents,
  discoveredCardIds, setDiscoveredCardIds, setEncounteredEnemyIds,
  autoEndTurn, homesteadEffectsRef, screen,
  setHoveredCardId, initialHasActiveBattle,
}: {
  run: ReturnType<typeof useRunState>;
  talents: ReturnType<typeof useTalentState>;
  discoveredCardIds: string[];
  setDiscoveredCardIds: React.Dispatch<React.SetStateAction<string[]>>;
  setEncounteredEnemyIds: React.Dispatch<React.SetStateAction<string[]>>;
  autoEndTurn: boolean;
  homesteadEffectsRef: React.MutableRefObject<HomesteadEffectManifest>;
  screen: Screen;
  setHoveredCardId: React.Dispatch<React.SetStateAction<string | null>>;
  initialHasActiveBattle?: boolean;
}) {
  const [battleState, setBattleState] = useState<BattleState>(() => createBattleState(starterDeck, 0));
  const [hasActiveBattle, setHasActiveBattle] = useState(initialHasActiveBattle ?? false);
  const [enemyShaking, setEnemyShaking] = useState(false);
  const [playerShaking, setPlayerShaking] = useState(false);
  const [companionShaking, setCompanionShaking] = useState(false);

  const handCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const battleSceneRef = useRef<HTMLDivElement | null>(null);
  const playerPanelRef = useRef<HTMLDivElement | null>(null);
  const enemyPanelRef = useRef<HTMLDivElement | null>(null);
  const cardPlayInProgressRef = useRef(false);
  const companionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const companionScheduledRef = useRef(false);
  const battleStateRef = useRef(battleState);
  const handleEndTurnRef = useRef(handleEndTurn);
  const autoEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { battleStateRef.current = battleState; }, [battleState]);
  useEffect(() => { handleEndTurnRef.current = handleEndTurn; }, [handleEndTurn]);
  useEffect(() => () => { if (companionTimeoutRef.current) clearTimeout(companionTimeoutRef.current); }, []);

  const { cardGhosts, removeCardGhost, clearCardGhosts, spawnCardGhost } = useCardGhosts();
  const { floatingCombatTexts, showCombatTexts } = useFloatingCombatTexts();
  const { shimmerState, maybeTriggerShimmer } = useShimmerController();

  const playerStatusChips = useMemo(() => getPlayerStatusChips(battleState), [battleState]);
  const enemyStatusChips = useMemo(() => getEnemyStatusChips(battleState), [battleState]);
  const playerCombatTexts = useMemo(() => floatingCombatTexts.filter((e) => e.target === "player"), [floatingCombatTexts]);
  const enemyCombatTexts = useMemo(() => floatingCombatTexts.filter((e) => e.target === "enemy"), [floatingCombatTexts]);

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

  function startBattle(deck: BattleCard[] = run.runDeck, gold: number = run.runGold, enemyType: "normal" | "elite" = "normal") {
    const enemy = getCurrentEnemy(run.roomsEncountered, enemyType);
    const grovesHeal = computeTrinketManifest(run.runTrinkets).grovesFavorStartHeal;
    if (grovesHeal > 0) run.setRunPlayerHealth((p) => Math.min(run.runMaxHealth, p + grovesHeal));
    run.setRoomsEncountered((p) => p + 1);
    clearCardGhosts();
    const mergedEffects = mergeIntoManifest(talents.talentEffects, homesteadEffectsRef.current);
    setBattleState(createBattleState(deck, gold, run.roomsEncountered, enemy, run.runPlayerHealth, mergedEffects, discoveredCardIds, run.runMaxHealth, run.runTrinkets, run.destinationIndexInAct, run.currentAct));
    setHasActiveBattle(true);
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
    setHasActiveBattle(true);
    setEncounteredEnemyIds((current) => current.includes(enemy.id) ? current : [...current, enemy.id]);
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

  function handleCardClick(card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) {
    handlePlayCard(card, index, getCardRect(event.currentTarget.getBoundingClientRect()));
  }

  function handleWishChoice(card: BattleCard) {
    setBattleState((current) => chooseWishCard(current, card.id));
    setDiscoveredCardIds((current) => current.includes(card.id) ? current : [...current, card.id]);
  }

  function handleEndTurn() {
    if (screen !== "battle" || battleState.turnPhase !== "player" || battleState.wishOptions || cardPlayInProgressRef.current) return;

    if (companionTimeoutRef.current) {
      clearTimeout(companionTimeoutRef.current);
      companionTimeoutRef.current = null;
    }

    let currentState = battleState;
    const preCombatTexts: CombatTextEvent[] = [];
    if (companionScheduledRef.current && currentState.activeCompanion) {
      playCardSound(`companion-${currentState.activeCompanion.id}`);
      currentState = processCompanionTurnStart(currentState, preCombatTexts);
      setCompanionShaking(true);
      setTimeout(() => setCompanionShaking(false), SHAKE_DURATION);
    }
    companionScheduledRef.current = false;

    const result = endPlayerTurn(currentState);
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
  function skipCombatDevMode() { if (screen === "battle") { setBattleState((c) => ({ ...c, enemyHealth: 0, wishOptions: null })); } }

  return {
    battleState, setBattleState,
    hasActiveBattle, setHasActiveBattle,
    enemyShaking, playerShaking, companionShaking,
    handCardRefs, battleSceneRef, playerPanelRef, enemyPanelRef,
    battleStateRef,
    cardGhosts, shimmerState, floatingCombatTexts,
    playerStatusChips, enemyStatusChips, playerCombatTexts, enemyCombatTexts,
    startBattle, startBossBattle,
    handleCardClick, handleWishChoice, handleEndTurn, handleEndRun,
    skipCombatDevMode, removeCardGhost, maybeTriggerShimmer, clearCardGhosts,
  };
}
