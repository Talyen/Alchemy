// React battle orchestrator for combat state, card play, turn timing, ghosts, and feedback.
// Depends on pure battle logic, run/talent state, homestead modifiers, audio, and UI hooks.
// Uses useBattleStore (Zustand) instead of local useState for battle data.
import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef } from "react";
import {
  chooseWishCard,
  createBattleState,
  endPlayerTurn,
  getEffectiveCost,
  playBattleCardResolved,
  processCompanionTurnStart,
  type BattleState,
  type CombatTextEvent,
} from "@/lib/battle";
import { getDifficultyModifiers, type BattleCard, type BestiaryEntry, type DifficultyModifier } from "@/lib/game-data";
import { playBattleEvent, playCardSound, playEnemyAttack, playGoldGain } from "@/lib/audio";
import { appendUnique } from "@/lib/utils";
import { getBossById, getCurrentEnemy, getBossEnemy } from "./config";
import { animateCardActivation } from "./battle/card-ghost-animation";
import type { Screen } from "./types";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import { CARD_ACTIVATION_ROTATION_DEGREES, COMPANION_ATTACK_DELAY, ENEMY_PHASE_DELAY } from "@/lib/game-constants";
import { getCardRect, getEnemyStatusChips, getHoverId, getPlayerStatusChips } from "./utils";
import type { RunStateController } from "./use-run-state";
import type { TalentStateController } from "./use-talent-state";
import {
  shouldPlayCardGoldGain,
  shouldShakeEnemyFromCombatTexts,
  shouldShakePlayerFromCombatTexts,
} from "./battle/battle-feedback";
import { useBattleAutoEndTurn } from "./battle/use-battle-auto-end-turn";
import { useBattleStore } from "./stores/battle-store";
import { getBattleStartPlayerHealth } from "./battle/battle-start";

export function useBattleController({
  run,
  talents,
  discoveredCardIds,
  setDiscoveredCardIds,
  setEncounteredEnemyIds,
  autoEndTurn,
  homesteadEffectsRef,
  screen,
  setHoveredCardId,
}: {
  run: RunStateController;
  talents: TalentStateController;
  discoveredCardIds: string[];
  setDiscoveredCardIds: React.Dispatch<React.SetStateAction<string[]>>;
  setEncounteredEnemyIds: React.Dispatch<React.SetStateAction<string[]>>;
  autoEndTurn: boolean;
  homesteadEffectsRef: React.MutableRefObject<HomesteadEffectManifest>;
  screen: Screen;
  setHoveredCardId: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  // React owns timing, refs, animation, and audio here; pure combat resolution stays in
  // @/lib/battle so UI delays cannot silently change battle outcomes.
  const battleState = useBattleStore((s) => s.battleState);
  const hasActiveBattle = useBattleStore((s) => s.hasActiveBattle);
  const enemyShaking = useBattleStore((s) => s.enemyShaking);
  const playerShaking = useBattleStore((s) => s.playerShaking);
  const companionShaking = useBattleStore((s) => s.companionShaking);
  const cardGhosts = useBattleStore((s) => s.cardGhosts);
  const floatingCombatTexts = useBattleStore((s) => s.floatingCombatTexts);
  const shimmerState = useBattleStore((s) => s.shimmerState);

  const handCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const battleSceneRef = useRef<HTMLDivElement | null>(null);
  const playerPanelRef = useRef<HTMLDivElement | null>(null);
  const enemyPanelRef = useRef<HTMLDivElement | null>(null);
  const cardPlayInProgressRef = useRef(false);
  const companionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enemyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const companionScheduledRef = useRef(false);
  function clearCompanionTimeout() {
    if (!companionTimeoutRef.current) return;
    clearTimeout(companionTimeoutRef.current);
    companionTimeoutRef.current = null;
  }

  function clearEnemyTimeout() {
    if (!enemyTimeoutRef.current) return;
    clearTimeout(enemyTimeoutRef.current);
    enemyTimeoutRef.current = null;
  }

  function clearPendingBattleTimeouts() {
    clearCompanionTimeout();
    clearEnemyTimeout();
    companionScheduledRef.current = false;
  }

  useEffect(
    () => () => {
      clearPendingBattleTimeouts();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const playerStatusChips = useMemo(() => (hasActiveBattle ? getPlayerStatusChips(battleState) : []), [battleState, hasActiveBattle]);
  const enemyStatusChips = useMemo(() => (hasActiveBattle ? getEnemyStatusChips(battleState) : []), [battleState, hasActiveBattle]);
  const playerCombatTexts = useMemo(
    () => floatingCombatTexts.filter((e) => e.target === "player"),
    [floatingCombatTexts],
  );
  const enemyCombatTexts = useMemo(
    () => floatingCombatTexts.filter((e) => e.target === "enemy"),
    [floatingCombatTexts],
  );
  const { scheduleAutoEndTurn } = useBattleAutoEndTurn({ autoEndTurn, screen, battleState, onEndTurn: handleEndTurn });

  function getStore() {
    return useBattleStore.getState();
  }

  function startBattle(
    deck: BattleCard[] = run.runDeck,
    gold: number = run.runGold,
    enemyType: "normal" | "elite" = "normal",
    modifiers?: DifficultyModifier[],
    scalingDepth?: number,
  ) {
    beginBattle(getCurrentEnemy(enemyType), deck, gold, modifiers, scalingDepth);
  }

  function startBossBattle(modifiers?: DifficultyModifier[], scalingDepth?: number) {
    beginBattle(getBossEnemy(run.currentAct), run.runDeck, run.runGold, modifiers, scalingDepth);
  }

  function startBossById(bossId: string, modifiers?: DifficultyModifier[]): boolean {
    const boss = getBossById(bossId);
    if (!boss) return false;
    beginBattle(boss, run.runDeck, run.runGold, modifiers);
    return true;
  }

  function beginBattle(
    enemy: BestiaryEntry,
    deck: BattleCard[],
    gold: number,
    modifiers?: DifficultyModifier[],
    scalingDepth?: number,
  ) {
    clearPendingBattleTimeouts();
    const startingHealth = getBattleStartPlayerHealth(run.runPlayerHealth, run.runMaxHealth, run.runTrinkets);
    run.setRunPlayerHealth(startingHealth);
    run.setRoomsEncountered((p) => p + 1);
    getStore().clearCardGhosts();
    const nextBattleState = createBattleForEnemy(enemy, deck, gold, startingHealth, modifiers, scalingDepth);
    getStore().setBattleState(nextBattleState);
    getStore().setHasActiveBattle(true);
    setEncounteredEnemyIds((current) => appendUnique(current, enemy.id));
  }

  function createBattleForEnemy(
    enemy: BestiaryEntry,
    deck: BattleCard[],
    gold: number,
    playerHealth: number,
    modifiers?: DifficultyModifier[],
    scalingDepth?: number,
  ) {
    const mergedEffects = mergeIntoManifest(talents.talentEffects, homesteadEffectsRef.current);
    const activeModifiers =
      modifiers ?? (run.selectedDifficulty ? getDifficultyModifiers(run.characterId, run.selectedDifficulty) : []);
    return createBattleState(
      deck,
      gold,
      run.roomsEncountered,
      enemy,
      playerHealth,
      mergedEffects,
      discoveredCardIds,
      run.runMaxHealth,
      run.runTrinkets,
      scalingDepth ?? run.destinationIndexInAct,
      run.currentAct,
      activeModifiers,
    );
  }

  function handlePlayCard(
    card: BattleCard,
    index: number,
    sourceRect: { x: number; y: number; width: number; height: number },
  ) {
    const currentState = getStore().battleState;
    if (!canPlayCard(card, index, currentState)) return;
    cardPlayInProgressRef.current = true;
    animatePlayedCard(card, index, sourceRect);
    playCardSound(card.id);
    const resolution = playBattleCardResolved(currentState, card.id, index);
    playCardResolutionFeedback(card, resolution.state, resolution.combatTexts);
    getStore().setBattleState(resolution.state);
    getStore().showCombatTexts(resolution.combatTexts);
    setHoveredCardId((current) => (current === getHoverId("hand", `${card.id}-${card.uid}`) ? null : current));
    talents.awardCardXP(card);
    cardPlayInProgressRef.current = false;
    scheduleAutoEndTurn(resolution.state);
  }

  function canPlayCard(card: BattleCard, index: number, state: BattleState) {
    const currentCard = state.hand[index];
    return (
      screen === "battle" &&
      currentCard?.id === card.id &&
      currentCard?.uid === card.uid &&
      state.mana >= getEffectiveCost(state, currentCard) &&
      !state.wishOptions &&
      state.turnPhase === "player" &&
      !cardPlayInProgressRef.current
    );
  }

  function animatePlayedCard(
    card: BattleCard,
    index: number,
    sourceRect: { x: number; y: number; width: number; height: number },
  ) {
    const centerOffset = index - (battleState.hand.length - 1) / 2;
    animateCardActivation(
      card,
      sourceRect,
      centerOffset * CARD_ACTIVATION_ROTATION_DEGREES,
      playerPanelRef,
      enemyPanelRef,
      battleSceneRef,
      getStore().spawnCardGhost,
    );
  }

  function playCardResolutionFeedback(card: BattleCard, state: BattleState, combatTexts: CombatTextEvent[]) {
    if (shouldPlayCardGoldGain(battleState, state, card)) playGoldGain();
    if (shouldShakeEnemyFromCombatTexts(combatTexts)) getStore().shakeEnemy();
  }

  function handleCardClick(card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) {
    handlePlayCard(card, index, getCardRect(event.currentTarget.getBoundingClientRect()));
  }

  function handleWishChoice(card: BattleCard) {
    getStore().setBattleState((current) => chooseWishCard(current, card.id));
    setDiscoveredCardIds((current) => appendUnique(current, card.id));
  }

  function handleEndTurn() {
    const currentState = getStore().battleState;
    if (
      screen !== "battle" ||
      currentState.turnPhase !== "player" ||
      currentState.wishOptions ||
      cardPlayInProgressRef.current
    )
      return;
    clearCompanionTimeout();

    const companionResult = resolveQueuedCompanionTurn(currentState);

    if (companionResult.state.enemyHealth <= 0) {
      getStore().setBattleState(companionResult.state);
      if (companionResult.combatTexts.length > 0) getStore().showCombatTexts(companionResult.combatTexts);
      return;
    }

    const result = endPlayerTurn(companionResult.state);
    const combinedCombatTexts = [...companionResult.combatTexts, ...result.combatTexts];

    showEnemyTurnStart(result.state, companionResult.state, combinedCombatTexts);
    if (result.state.enemyHealth <= 0) return;
    scheduleEnemyTurnResolution(result.state, companionResult.state, combinedCombatTexts);
  }

  function resolveQueuedCompanionTurn(state: BattleState) {
    const combatTexts: CombatTextEvent[] = [];
    if (companionScheduledRef.current && state.activeCompanion) {
      playCardSound(`companion-${state.activeCompanion.id}`);
      const nextState = processCompanionTurnStart(state, combatTexts);
      getStore().shakeCompanion();
      companionScheduledRef.current = false;
      return { state: nextState, combatTexts };
    }
    companionScheduledRef.current = false;
    return { state, combatTexts };
  }

  function showEnemyTurnStart(resultState: BattleState, currentState: BattleState, combatTexts: CombatTextEvent[]) {
    const displayState: BattleState = {
      ...resultState,
      turnPhase: "enemy",
      hand: [],
      playerHealth: currentState.playerHealth,
      playerStatuses: currentState.playerStatuses,
    };
    getStore().setBattleState(displayState);
    const dotTexts = combatTexts.filter((ct) => ct.target === "enemy");
    if (dotTexts.length > 0) getStore().showCombatTexts(dotTexts);
  }

  function scheduleEnemyTurnResolution(
    resultState: BattleState,
    currentState: BattleState,
    combatTexts: CombatTextEvent[],
  ) {
    const playerTexts = combatTexts.filter((ct) => ct.target === "player");
    clearEnemyTimeout();
    enemyTimeoutRef.current = setTimeout(() => {
      enemyTimeoutRef.current = null;
      playEnemyAttack(currentState.currentEnemy.id);
      if (!currentState.deathsDoorActive && resultState.deathsDoorActive) playBattleEvent("deathsDoor");
      getStore().setBattleState(resultState);
      if (playerTexts.length > 0) getStore().showCombatTexts(playerTexts);
      if (shouldShakePlayerFromCombatTexts(playerTexts)) getStore().shakePlayer();
      scheduleCompanionFollowUp(resultState);
    }, ENEMY_PHASE_DELAY);
  }

  function scheduleCompanionFollowUp(resultState: BattleState) {
    if (!resultState.activeCompanion || resultState.enemyHealth <= 0) return;
    companionTimeoutRef.current = setTimeout(() => {
      const texts = resolveCompanionFollowUpTexts();
      if (texts.length > 0) getStore().showCombatTexts(texts);
      companionTimeoutRef.current = null;
      companionScheduledRef.current = false;
    }, COMPANION_ATTACK_DELAY);
    companionScheduledRef.current = true;
  }

  function resolveCompanionFollowUpTexts() {
    const store = getStore();
    const texts: CombatTextEvent[] = [];
    if (store.battleState.activeCompanion) {
      playCardSound(`companion-${store.battleState.activeCompanion.id}`);
    }
    const newState = processCompanionTurnStart(store.battleState, texts);
    store.setBattleState(newState);
    store.shakeCompanion();
    return texts;
  }

  function handleEndRun() {
    if (screen !== "battle") return;
    clearPendingBattleTimeouts();
    getStore().setBattleState((c) => ({
      ...c,
      playerHealth: 0,
      deathsDoorUsed: true,
      deathsDoorActive: false,
      deathsDoorTriggeredTurn: null,
    }));
  }

  function skipCombatDevMode() {
    if (screen === "battle") {
      clearPendingBattleTimeouts();
      getStore().setBattleState((c) => ({ ...c, enemyHealth: 0, wishOptions: null, wishQueue: [] }));
    }
  }

  return {
    battleState,
    setBattleState: getStore().setBattleState,
    hasActiveBattle,
    setHasActiveBattle: getStore().setHasActiveBattle,
    enemyShaking,
    playerShaking,
    companionShaking,
    handCardRefs,
    battleSceneRef,
    playerPanelRef,
    enemyPanelRef,
    cardGhosts,
    shimmerState,
    floatingCombatTexts,
    playerStatusChips,
    enemyStatusChips,
    playerCombatTexts,
    enemyCombatTexts,
    startBattle,
    startBossBattle,
    startBossById,
    handleCardClick,
    handleWishChoice,
    handleEndTurn,
    handleEndRun,
    skipCombatDevMode,
    removeCardGhost: getStore().removeCardGhost,
    maybeTriggerShimmer: getStore().maybeTriggerShimmer,
    clearCardGhosts: getStore().clearCardGhosts,
  };
}
