// React battle orchestrator for combat state, card play, turn timing, ghosts, and feedback.
// Depends on pure battle logic, run/talent state, homestead modifiers, audio, and UI hooks.
// Uses useBattleStore (Zustand) instead of local useState for battle data.
import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
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
import {
  animateCardActivation,
  getBattleSceneLocalRect,
  viewportRectToBattleSceneRect,
} from "./battle/card-ghost-animation";
import { getBossById, getCurrentEnemy, getBossEnemy } from "./config";
import type { CardRect, CardTransfer, Screen } from "./types";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import {
  CARD_ACTIVATION_ROTATION_DEGREES,
  COMPANION_ATTACK_DELAY,
  ENEMY_PHASE_DELAY,
  HAND_FAN_ROTATION_DEGREES,
} from "@/lib/game-constants";
import { getCardRect, getHoverId } from "./utils";
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
import { getAudioContext, loadSoundBuffer, resumeAudioContext } from "@/lib/audio-buffer-cache";

const CARD_TRANSFER_DRAW_DURATION_SECONDS = 0.55;
const CARD_TRANSFER_DISCARD_DURATION_SECONDS = 0.45;
const CARD_TRANSFER_COMPLETION_BUFFER_MS = 120;
const REQUIRED_STABLE_SLOT_FRAMES = 2;
const MAX_SLOT_STABILIZE_FRAMES = 12;

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
  const drawPileRef = useRef<HTMLDivElement | null>(null);
  const discardPileRef = useRef<HTMLDivElement | null>(null);
  const battleSceneRef = useRef<HTMLDivElement | null>(null);
  const playerPanelRef = useRef<HTMLDivElement | null>(null);
  const enemyPanelRef = useRef<HTMLDivElement | null>(null);
  const cardPlayInProgressRef = useRef(false);
  const companionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enemyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transferTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transferMeasureFrameRef = useRef<number | null>(null);
  const transferSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const companionScheduledRef = useRef(false);
  const [cardTransfers, setCardTransfers] = useState<CardTransfer[]>([]);
  const [hiddenHandCardKeys, setHiddenHandCardKeys] = useState<Set<string>>(new Set());
  const [cardTransferInProgress, setCardTransferInProgress] = useState(false);
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

  function clearTransferHandles() {
    if (transferTimeoutRef.current) clearTimeout(transferTimeoutRef.current);
    if (transferMeasureFrameRef.current !== null) cancelAnimationFrame(transferMeasureFrameRef.current);
    if (transferSafetyTimerRef.current !== null) clearTimeout(transferSafetyTimerRef.current);
    transferTimeoutRef.current = null;
    transferMeasureFrameRef.current = null;
    transferSafetyTimerRef.current = null;
  }

  function clearPendingBattleTimeouts() {
    clearCompanionTimeout();
    clearEnemyTimeout();
    companionScheduledRef.current = false;
  }

  useEffect(
    () => () => {
      if (companionTimeoutRef.current) clearTimeout(companionTimeoutRef.current);
      if (enemyTimeoutRef.current) clearTimeout(enemyTimeoutRef.current);
      clearTransferHandles();
      companionTimeoutRef.current = null;
      enemyTimeoutRef.current = null;
      companionScheduledRef.current = false;
    },
    [],
  );

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

  function getCardKey(card: BattleCard) {
    return `${card.id}-${card.uid}`;
  }

  function playTransferSound() {
    resumeAudioContext();
    loadSoundBuffer("card-draw-2.ogg").then((buffer) => {
      if (!buffer) return;
      const ctx = getAudioContext();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = 0.4;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    });
  }

  function localRectFromElement(element: HTMLElement | null): CardRect | null {
    const sceneRect = getBattleSceneLocalRect(battleSceneRef.current);
    if (!element || !sceneRect) return null;
    const rect = element.getBoundingClientRect();
    return viewportRectToBattleSceneRect(
      { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      sceneRect,
    );
  }

  function localVisualCardRect(element: HTMLElement | null): CardRect | null {
    const sceneRect = getBattleSceneLocalRect(battleSceneRef.current);
    if (!element || !sceneRect) return null;
    const rect = element.getBoundingClientRect();
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    return {
      x: (rect.left + rect.width / 2 - sceneRect.left) / sceneRect.scaleX - width / 2,
      y: (rect.top + rect.height / 2 - sceneRect.top) / sceneRect.scaleY - height / 2,
      width,
      height,
    };
  }

  function centeredRectForSize(centerSource: CardRect, width: number, height: number): CardRect {
    return {
      x: centerSource.x + centerSource.width / 2 - width / 2,
      y: centerSource.y + centerSource.height / 2 - height / 2,
      width,
      height,
    };
  }

  function runCardTransfer(transfer: Omit<CardTransfer, "id">, onComplete?: () => void): Promise<void> {
    return new Promise((resolve) => {
      const id = `${performance.now()}-${Math.random()}`;
      playTransferSound();
      setCardTransfers([{ ...transfer, id }]);
      transferTimeoutRef.current = setTimeout(
        () => {
          transferTimeoutRef.current = null;
          setCardTransfers((current) => current.filter((item) => item.id !== id));
          onComplete?.();
          resolve();
        },
        Math.round(transfer.duration * 1000) + CARD_TRANSFER_COMPLETION_BUFFER_MS,
      );
    });
  }

  function waitForStableHandCardRect(cardKey: string, fallback: CardRect): Promise<CardRect> {
    return new Promise((resolve) => {
      let frameCount = 0;
      let stableFrames = 0;
      let lastRect: CardRect | null = null;

      transferSafetyTimerRef.current = setTimeout(() => {
        transferSafetyTimerRef.current = null;
        if (transferMeasureFrameRef.current !== null) {
          cancelAnimationFrame(transferMeasureFrameRef.current);
          transferMeasureFrameRef.current = null;
        }
        resolve(localVisualCardRect(handCardRefs.current[cardKey]) ?? fallback);
      }, 2000);

      function tick() {
        transferMeasureFrameRef.current = null;
        frameCount += 1;
        const rect = localVisualCardRect(handCardRefs.current[cardKey]) ?? fallback;
        if (lastRect && Math.abs(rect.x - lastRect.x) < 0.5 && Math.abs(rect.y - lastRect.y) < 0.5) {
          stableFrames += 1;
        } else {
          stableFrames = 0;
        }
        lastRect = rect;

        if (stableFrames >= REQUIRED_STABLE_SLOT_FRAMES || frameCount >= MAX_SLOT_STABILIZE_FRAMES) {
          if (transferSafetyTimerRef.current !== null) {
            clearTimeout(transferSafetyTimerRef.current);
            transferSafetyTimerRef.current = null;
          }
          resolve(rect);
          return;
        }

        transferMeasureFrameRef.current = requestAnimationFrame(tick);
      }

      transferMeasureFrameRef.current = requestAnimationFrame(tick);
    });
  }

  async function animateDiscardedHand(cards: BattleCard[]) {
    const discardPileRect = localRectFromElement(discardPileRef.current);
    if (!discardPileRect || cards.length === 0) return;
    setCardTransferInProgress(true);
    cardPlayInProgressRef.current = true;
    for (let index = cards.length - 1; index >= 0; index -= 1) {
      const card = cards[index];
      const cardKey = getCardKey(card);
      const sourceRect = localVisualCardRect(handCardRefs.current[cardKey]);
      if (!sourceRect) continue;
      const targetRect = centeredRectForSize(discardPileRect, sourceRect.width, sourceRect.height);
      setHiddenHandCardKeys((current) => new Set(current).add(cardKey));
      await runCardTransfer({
        card,
        from: sourceRect,
        to: targetRect,
        fromScale: 1,
        toScale: discardPileRect.width / sourceRect.width,
        fromRotation: (index - (cards.length - 1) / 2) * HAND_FAN_ROTATION_DEGREES,
        toRotation: 0,
        rotateY: [0, 90, 180],
        duration: CARD_TRANSFER_DISCARD_DURATION_SECONDS,
      });
    }
  }

  async function animateDrawnHand(cards: BattleCard[], allHandCards: BattleCard[]) {
    const drawPileRect = localRectFromElement(drawPileRef.current);
    if (!drawPileRect || cards.length === 0) return;
    for (const card of cards) {
      const index = allHandCards.findIndex((item) => item.uid === card.uid && item.id === card.id);
      const cardKey = getCardKey(card);
      const fallbackRect = centeredRectForSize(drawPileRect, drawPileRect.width, drawPileRect.height);
      const targetRect = await waitForStableHandCardRect(cardKey, fallbackRect);
      const sourceRect = centeredRectForSize(drawPileRect, targetRect.width, targetRect.height);
      await runCardTransfer(
        {
          card,
          from: sourceRect,
          to: targetRect,
          fromScale: drawPileRect.width / targetRect.width,
          toScale: 1,
          fromRotation: 0,
          toRotation: (index - (allHandCards.length - 1) / 2) * HAND_FAN_ROTATION_DEGREES,
          rotateY: [180, 90, 0],
          duration: CARD_TRANSFER_DRAW_DURATION_SECONDS,
        },
        () => {
          setHiddenHandCardKeys((current) => {
            const next = new Set(current);
            next.delete(cardKey);
            return next;
          });
          getStore().addRevealedCardKey(cardKey);
        },
      );
    }
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
    clearTransferHandles();
    setCardTransfers([]);
    setHiddenHandCardKeys(new Set());
    setCardTransferInProgress(false);
    cardPlayInProgressRef.current = false;
    getStore().clearRevealedCardKeys();
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

  function detectNewHandCards(oldHand: BattleCard[], newHand: BattleCard[]): BattleCard[] {
    const oldUidSet = new Set(oldHand.map((c) => c.uid));
    return newHand.filter((c) => !oldUidSet.has(c.uid));
  }

  // Shared draw-sequence lifecycle: diff hand, set hidden keys, flushSync, animate, cleanup.
  // Returns true when new cards were drawn and animated.
  async function handleDrawSequence(
    oldHand: BattleCard[],
    newState: BattleState,
    applyState: () => void,
  ): Promise<boolean> {
    const drawnCards = detectNewHandCards(oldHand, newState.hand);
    if (drawnCards.length === 0) {
      applyState();
      return false;
    }
    const hiddenDrawKeys = new Set(drawnCards.map(getCardKey));
    setCardTransferInProgress(true);
    flushSync(() => {
      setHiddenHandCardKeys(hiddenDrawKeys);
      applyState();
    });
    await animateDrawnHand(drawnCards, newState.hand);
    setCardTransferInProgress(false);
    return true;
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
    getStore().showCombatTexts(resolution.combatTexts);
    setHoveredCardId((current) => (current === getHoverId("hand", `${card.id}-${card.uid}`) ? null : current));
    talents.awardCardXP(card);

    void handleDrawSequence(currentState.hand, resolution.state, () => {
      getStore().setBattleState(resolution.state);
    }).finally(() => {
      cardPlayInProgressRef.current = false;
    });
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
      !cardPlayInProgressRef.current &&
      !hiddenHandCardKeys.has(getCardKey(card))
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
    const currentState = getStore().battleState;
    const newState = chooseWishCard(currentState, card.id);
    setDiscoveredCardIds((current) => appendUnique(current, card.id));
    void handleDrawSequence(currentState.hand, newState, () => {
      getStore().setBattleState(newState);
    });
  }

  function handleEndTurn() {
    const currentState = getStore().battleState;
    if (
      screen !== "battle" ||
      currentState.turnPhase !== "player" ||
      currentState.wishOptions ||
      cardPlayInProgressRef.current ||
      cardTransferInProgress
    )
      return;
    clearCompanionTimeout();

    void animateEndTurnThenResolve(currentState);
  }

  async function animateEndTurnThenResolve(currentState: BattleState) {
    try {
      await animateDiscardedHand(currentState.hand);
      resolveEndTurn(currentState);
    } finally {
      // haste/stun path manages its own transfer lifecycle; only clear if we didn't go there
      if (!resolvedAsHasteOrStunRef.current) {
        setHiddenHandCardKeys(new Set());
        setCardTransferInProgress(false);
        cardPlayInProgressRef.current = false;
      }
    }
  }

  const resolvedAsHasteOrStunRef = useRef(false);

  function resolveEndTurn(currentState: BattleState) {
    const companionResult = resolveQueuedCompanionTurn(currentState);

    if (companionResult.state.enemyHealth <= 0) {
      getStore().setBattleState(companionResult.state);
      if (companionResult.combatTexts.length > 0) getStore().showCombatTexts(companionResult.combatTexts);
      return;
    }

    const result = endPlayerTurn(companionResult.state);

    // Haste or stun skip: immediately show player turn and animate draw
    // (enemyTurnStartState is undefined in these paths)
    if (!result.enemyTurnStartState) {
      resolvedAsHasteOrStunRef.current = true;
      if (result.combatTexts.length > 0) getStore().showCombatTexts(result.combatTexts);
      void handleDrawSequence(companionResult.state.hand, result.state, () => {
        getStore().setBattleState(result.state);
      }).finally(() => {
        resolvedAsHasteOrStunRef.current = false;
        scheduleCompanionFollowUp(result.state);
      });
      return;
    }

    const enemyTurnStartTexts = result.enemyTurnStartState
      ? [...companionResult.combatTexts, ...result.enemyTurnStartCombatTexts]
      : [...companionResult.combatTexts, ...result.combatTexts];
    const enemyResolutionTexts = result.enemyTurnStartState ? result.enemyResolutionCombatTexts : result.combatTexts;

    showEnemyTurnStart(
      result.enemyTurnStartState ?? result.state,
      companionResult.state,
      enemyTurnStartTexts,
      Boolean(result.enemyTurnStartState),
    );
    if (result.state.enemyHealth <= 0) {
      getStore().setBattleState({ ...result.state, turnPhase: "enemy", hand: [] });
      return;
    }
    scheduleEnemyTurnResolution(result.state, companionResult.state, enemyResolutionTexts);
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

  function showEnemyTurnStart(
    resultState: BattleState,
    currentState: BattleState,
    combatTexts: CombatTextEvent[],
    showPlayerUpdates: boolean,
  ) {
    const displayState: BattleState = {
      ...resultState,
      turnPhase: "enemy",
      hand: [],
      ...(showPlayerUpdates
        ? {}
        : { playerHealth: currentState.playerHealth, playerStatuses: currentState.playerStatuses }),
    };
    getStore().setBattleState(displayState);
    const dotTexts = combatTexts.filter((ct) => ct.target === "enemy" || ct.kind === "heal");
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
      if (combatTexts.length > 0) getStore().showCombatTexts(combatTexts);
      if (shouldShakePlayerFromCombatTexts(playerTexts)) getStore().shakePlayer();
      void handleDrawSequence(currentState.hand, resultState, () => {
        getStore().setBattleState(resultState);
      }).finally(() => {
        scheduleCompanionFollowUp(resultState);
      });
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
    drawPileRef,
    discardPileRef,
    battleSceneRef,
    playerPanelRef,
    enemyPanelRef,
    cardGhosts,
    cardTransfers,
    hiddenHandCardKeys,
    cardTransferInProgress,
    shimmerState,
    floatingCombatTexts,
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
