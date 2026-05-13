// React battle orchestrator for combat state, card play, turn timing, ghosts, and feedback.
// Depends on pure battle logic, run/talent state, homestead modifiers, audio, and UI hooks.
// Used by the alchemy controller while keeping deterministic combat rules in @/lib/battle.
import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  chooseWishCard, createBattleState, endPlayerTurn,
  getEffectiveCost, playBattleCardResolved, processCompanionTurnStart,
  type BattleState, type CombatTextEvent,
} from "@/lib/battle";
import { starterDeck, type BattleCard, type BestiaryEntry } from "@/lib/game-data";
import { playBattleEvent, playCardSound, playEnemyAttack, playGoldGain } from "@/lib/audio";
import { appendUnique } from "@/lib/utils";
import { getCurrentEnemy, getBossEnemy } from "./config";
import { useCardGhosts, useFloatingCombatTexts, useShimmerController } from "./hooks";
import { animateCardActivation } from "./run-controller-helpers";
import type { Screen } from "./types";
import { computeTrinketManifest } from "@/lib/trinkets";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import {
  CARD_ACTIVATION_ROTATION_DEGREES, COMPANION_ATTACK_DELAY,
  ENEMY_PHASE_DELAY,
} from "@/lib/game-constants";
import { getCardRect, getEnemyStatusChips, getHoverId, getPlayerStatusChips } from "./utils";
import type { useRunState } from "./use-run-state";
import type { useTalentState } from "./use-talent-state";
import { shouldPlayCardGoldGain, shouldShakeEnemyFromCombatTexts, shouldShakePlayerFromCombatTexts } from "./battle/battle-feedback";
import { useBattleAutoEndTurn } from "./battle/use-battle-auto-end-turn";
import { useBattleShake } from "./battle/use-battle-shake";

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
  // React owns timing, refs, animation, and audio here; pure combat resolution stays in
  // @/lib/battle so UI delays cannot silently change battle outcomes.
  const [battleState, setBattleState] = useState<BattleState>(() => createBattleState(starterDeck, 0));
  const [hasActiveBattle, setHasActiveBattle] = useState(initialHasActiveBattle ?? false);
  const { enemyShaking, playerShaking, companionShaking, shakeEnemy, shakePlayer, shakeCompanion } = useBattleShake();

  const handCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const battleSceneRef = useRef<HTMLDivElement | null>(null);
  const playerPanelRef = useRef<HTMLDivElement | null>(null);
  const enemyPanelRef = useRef<HTMLDivElement | null>(null);
  const cardPlayInProgressRef = useRef(false);
  const companionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const companionScheduledRef = useRef(false);
  const battleStateRef = useRef(battleState);

  useEffect(() => { battleStateRef.current = battleState; }, [battleState]);
  useEffect(() => () => { if (companionTimeoutRef.current) clearTimeout(companionTimeoutRef.current); }, []);

  const { cardGhosts, removeCardGhost, clearCardGhosts, spawnCardGhost } = useCardGhosts();
  const { floatingCombatTexts, showCombatTexts } = useFloatingCombatTexts();
  const { shimmerState, maybeTriggerShimmer } = useShimmerController();

  const playerStatusChips = useMemo(() => getPlayerStatusChips(battleState), [battleState]);
  const enemyStatusChips = useMemo(() => getEnemyStatusChips(battleState), [battleState]);
  const playerCombatTexts = useMemo(() => floatingCombatTexts.filter((e) => e.target === "player"), [floatingCombatTexts]);
  const enemyCombatTexts = useMemo(() => floatingCombatTexts.filter((e) => e.target === "enemy"), [floatingCombatTexts]);
  const { scheduleAutoEndTurn } = useBattleAutoEndTurn({ autoEndTurn, screen, battleState, onEndTurn: handleEndTurn });

  function startBattle(deck: BattleCard[] = run.runDeck, gold: number = run.runGold, enemyType: "normal" | "elite" = "normal") {
    beginBattle(getCurrentEnemy(enemyType), deck, gold);
  }

  function startBossBattle() {
    beginBattle(getBossEnemy(run.currentAct), run.runDeck, run.runGold);
  }

  function beginBattle(enemy: BestiaryEntry, deck: BattleCard[], gold: number) {
    // Battle setup batches start-heal trinkets, room count, ghost cleanup, immutable
    // state creation, and bestiary discovery so the first battle render is coherent.
    applyGrovesFavorHeal();
    run.setRoomsEncountered((p) => p + 1);
    clearCardGhosts();
    setBattleState(createBattleForEnemy(enemy, deck, gold));
    setHasActiveBattle(true);
    setEncounteredEnemyIds((current) => appendUnique(current, enemy.id));
  }

  function applyGrovesFavorHeal() {
    const grovesHeal = computeTrinketManifest(run.runTrinkets).grovesFavorStartHeal;
    if (grovesHeal > 0) run.setRunPlayerHealth((p) => Math.min(run.runMaxHealth, p + grovesHeal));
  }

  function createBattleForEnemy(enemy: BestiaryEntry, deck: BattleCard[], gold: number) {
    // Talent and homestead bonuses are merged before state creation so the battle engine
    // reads one precomputed manifest instead of consulting React/controller state mid-fight.
    const mergedEffects = mergeIntoManifest(talents.talentEffects, homesteadEffectsRef.current);
    return createBattleState(deck, gold, run.roomsEncountered, enemy, run.runPlayerHealth, mergedEffects, discoveredCardIds, run.runMaxHealth, run.runTrinkets, run.destinationIndexInAct, run.currentAct);
  }

  function handlePlayCard(card: BattleCard, index: number, sourceRect: { x: number; y: number; width: number; height: number }) {
    // Play validation happens before animation/audio, then pure resolution drives XP,
    // combat text, hover cleanup, and any auto-end scheduling from the resolved state.
    if (!canPlayCard(card)) return;
    cardPlayInProgressRef.current = true;
    animatePlayedCard(card, index, sourceRect);
    playCardSound(card.id);
    const resolution = playBattleCardResolved(battleState, card.id, index);
    playCardResolutionFeedback(card, resolution.state, resolution.combatTexts);
    setBattleState(resolution.state);
    showCombatTexts(resolution.combatTexts);
    setHoveredCardId((current) => (current === getHoverId("hand", `${card.id}-${card.uid}`) ? null : current));
    talents.awardCardXP(card);
    cardPlayInProgressRef.current = false;
    scheduleAutoEndTurn(resolution.state);
  }

  function canPlayCard(card: BattleCard) {
    return screen === "battle" && battleState.mana >= getEffectiveCost(battleState, card)
      && !battleState.wishOptions && battleState.turnPhase === "player" && !cardPlayInProgressRef.current;
  }

  function animatePlayedCard(card: BattleCard, index: number, sourceRect: { x: number; y: number; width: number; height: number }) {
    const centerOffset = index - (battleState.hand.length - 1) / 2;
    animateCardActivation(card, sourceRect, centerOffset * CARD_ACTIVATION_ROTATION_DEGREES, playerPanelRef, enemyPanelRef, battleSceneRef, spawnCardGhost);
  }

  function playCardResolutionFeedback(card: BattleCard, state: BattleState, combatTexts: CombatTextEvent[]) {
    if (shouldPlayCardGoldGain(battleState, state, card)) playGoldGain();
    if (shouldShakeEnemyFromCombatTexts(combatTexts)) shakeEnemy();
  }

  function handleCardClick(card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) {
    handlePlayCard(card, index, getCardRect(event.currentTarget.getBoundingClientRect()));
  }

  function handleWishChoice(card: BattleCard) {
    setBattleState((current) => chooseWishCard(current, card.id));
    setDiscoveredCardIds((current) => appendUnique(current, card.id));
  }

  function handleEndTurn() {
    // Queued companion effects resolve before the enemy action, then enemy damage is
    // delayed for readability while the pure end-turn result remains already computed.
    if (screen !== "battle" || battleState.turnPhase !== "player" || battleState.wishOptions || cardPlayInProgressRef.current) return;
    clearCompanionTimeout();

    const companionResult = resolveQueuedCompanionTurn(battleState);

    // If the companion killed the enemy, skip the enemy phase entirely — otherwise
    // processEnemyHealing would resurrect the enemy from below-50% HP healing.
    if (companionResult.state.enemyHealth <= 0) {
      setBattleState(companionResult.state);
      if (companionResult.combatTexts.length > 0) showCombatTexts(companionResult.combatTexts);
      return;
    }

    const result = endPlayerTurn(companionResult.state);
    const combinedCombatTexts = [...companionResult.combatTexts, ...result.combatTexts];

    showEnemyTurnStart(result.state, companionResult.state, combinedCombatTexts);
    if (result.state.enemyHealth <= 0) return;
    scheduleEnemyTurnResolution(result.state, companionResult.state, combinedCombatTexts);
  }

  function clearCompanionTimeout() {
    if (!companionTimeoutRef.current) return;
    clearTimeout(companionTimeoutRef.current);
    companionTimeoutRef.current = null;
  }

  function resolveQueuedCompanionTurn(state: BattleState) {
    // Manual end-turn can consume a scheduled companion trigger so delayed follow-ups do
    // not duplicate the same companion turn-start effect.
    const combatTexts: CombatTextEvent[] = [];
    if (companionScheduledRef.current && state.activeCompanion) {
      playCardSound(`companion-${state.activeCompanion.id}`);
      const nextState = processCompanionTurnStart(state, combatTexts);
      shakeCompanion();
      companionScheduledRef.current = false;
      return { state: nextState, combatTexts };
    }
    companionScheduledRef.current = false;
    return { state, combatTexts };
  }

  function showEnemyTurnStart(resultState: BattleState, currentState: BattleState, combatTexts: CombatTextEvent[]) {
    // The UI briefly shows enemy phase with the hand cleared but preserves pre-attack
    // player HP/status so enemy-target DoT text can read before player damage lands.
    setBattleState({ ...resultState, turnPhase: "enemy", hand: [], playerHealth: currentState.playerHealth, playerStatuses: currentState.playerStatuses });
    const dotTexts = combatTexts.filter((ct) => ct.target === "enemy");
    if (dotTexts.length > 0) showCombatTexts(dotTexts);
  }

  function scheduleEnemyTurnResolution(resultState: BattleState, currentState: BattleState, combatTexts: CombatTextEvent[]) {
    // Enemy audio, player damage text, and shake are delayed to make the phase transition
    // legible; resultState was already computed, so this is presentation timing only.
    const playerTexts = combatTexts.filter((ct) => ct.target === "player");
    setTimeout(() => {
      playEnemyAttack(currentState.currentEnemy.id);
      if (!currentState.deathsDoorActive && resultState.deathsDoorActive) playBattleEvent("deathsDoor");
      setBattleState(resultState);
      if (playerTexts.length > 0) showCombatTexts(playerTexts);
      if (shouldShakePlayerFromCombatTexts(playerTexts)) shakePlayer();
      scheduleCompanionFollowUp(resultState);
    }, ENEMY_PHASE_DELAY);
  }

  function scheduleCompanionFollowUp(resultState: BattleState) {
    // Companion follow-up is tracked with refs because the timeout can outlive renders;
    // the flags prevent overlapping or duplicate companion animations/effects.
    if (!resultState.activeCompanion || resultState.enemyHealth <= 0) return;
    companionTimeoutRef.current = setTimeout(() => {
      const texts = resolveCompanionFollowUpTexts();
      if (texts.length > 0) showCombatTexts(texts);
      companionTimeoutRef.current = null;
      companionScheduledRef.current = false;
    }, COMPANION_ATTACK_DELAY);
    companionScheduledRef.current = true;
  }

  function resolveCompanionFollowUpTexts() {
    // Read the latest battle state inside the timeout to avoid stale closure state after
    // enemy resolution, victory checks, or other delayed React updates.
    const texts: CombatTextEvent[] = [];
    if (battleStateRef.current.activeCompanion) {
      playCardSound(`companion-${battleStateRef.current.activeCompanion.id}`);
    }
    const newState = processCompanionTurnStart(battleStateRef.current, texts);
    setBattleState(newState);
    shakeCompanion();
    return texts;
  }

  function handleEndRun() { if (screen !== "battle") return; setBattleState((c) => ({ ...c, playerHealth: 0, deathsDoorUsed: true, deathsDoorActive: false, deathsDoorTriggeredTurn: null })); }
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
