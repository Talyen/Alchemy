// React battle orchestrator for combat state, card play, turn timing, ghosts, and feedback.
// Depends on pure battle logic, run/talent state, homestead modifiers, audio, and UI hooks.
// Depended on by: useAlchemyRunController for managing active combat.
// Uses useBattleStore (Zustand) instead of local useState for battle data.
import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  chooseWishCard,
  createBattleState,
  endPlayerTurn,
  getEffectiveCost,
  playBattleCardResolved,
  processCompanionTurnStart,
  type BattleState,
  type CombatTextEvent,
  isPlayerDefeated,
} from "@/lib/battle";
import { getDifficultyModifiers, type BattleCard, type BestiaryEntry, type DifficultyModifier } from "@/lib/game-data";
import { playBattleEvent, playCardSound, playEnemyAttack, playGoldGain, stopAllSfx } from "@/lib/audio";
import { appendUnique } from "@/lib/utils";
import { logError } from "@/lib/error-logger";
import { animateCardActivation } from "./battle/card-ghost-animation";
import { getBossById, getCurrentEnemy, getBossEnemy } from "./config";
import type { CardRect, CardTransfer, Screen } from "./types";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import {
  CARD_ACTIVATION_ROTATION_DEGREES,
  CARD_TRANSFER_CONFIG,
  COMPANION_ATTACK_DELAY,
  ENEMY_ATTACK_RECOVERY_DELAY,
  ENEMY_PHASE_DELAY,
  HAND_FAN_ROTATION_DEGREES,
  isAnimationDisabled,
} from "@/lib/game-constants";
import { delay, TimerGroup } from "@/lib/animation/game-timer";
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
import { useRunStore } from "./stores/run-store";
import { useScreenStore } from "./stores/screen-store";
import { getBattleStartPlayerHealth } from "./battle/battle-start";
import { createTransferCancelRegistry } from "./battle/transfer-lifecycle";
import {
  centeredRectForSize,
  defaultMeasureElementRect,
  defaultMeasureVisualCardRect,
  getCardKey,
  getCardTransferBatchSpeed,
  playCompanionSound,
} from "./battle/controller-utils";

// ─── Store subscriptions ───
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
  onBattleVictory,
  onBattleDefeat,
  measureElementRect = defaultMeasureElementRect,
  measureVisualCardRect = defaultMeasureVisualCardRect,
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
  onBattleVictory?: () => void;
  onBattleDefeat?: () => void;
  measureElementRect?: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
  measureVisualCardRect?: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
}) {
  // React owns timing, refs, animation, and audio here; pure combat resolution stays in
  // @/lib/battle so UI delays cannot silently change battle outcomes.
  const battleState = useBattleStore((s) => s.battleState);
  const battleStartState = useBattleStore((s) => s.battleStartState);
  const hasActiveBattle = useBattleStore((s) => s.hasActiveBattle);
  const enemyShaking = useBattleStore((s) => s.enemyShaking);
  const playerShaking = useBattleStore((s) => s.playerShaking);
  const companionShaking = useBattleStore((s) => s.companionShaking);
  const cardGhosts = useBattleStore((s) => s.cardGhosts);
  const floatingCombatTexts = useBattleStore((s) => s.floatingCombatTexts);
  const shimmerState = useScreenStore((s) => s.shimmerState);

  const handCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const drawPileRef = useRef<HTMLDivElement | null>(null);
  const discardPileRef = useRef<HTMLDivElement | null>(null);
  const battleSceneRef = useRef<HTMLDivElement | null>(null);
  const playerPanelRef = useRef<HTMLDivElement | null>(null);
  const enemyPanelRef = useRef<HTMLDivElement | null>(null);
  const cardPlayInProgressRef = useRef(false);
  const companionScheduledRef = useRef(false);
  const battleTimerGroupRef = useRef(new TimerGroup());
  const battleSessionRef = useRef(0);
  const victoryDefeatHandledRef = useRef(false);
  const transferCancelRegistryRef = useRef(createTransferCancelRegistry());
  const [cardTransfers, setCardTransfers] = useState<CardTransfer[]>([]);
  const [hiddenHandCardKeys, setHiddenHandCardKeys] = useState<Set<string>>(new Set());
  const [cardTransferInProgress, setCardTransferInProgress] = useState(false);
  const transferIdCounterRef = useRef(0);

  // ─── Session lifecycle ───
  function invalidateBattleSession() {
    battleSessionRef.current += 1;
  }

  function isCurrentBattleSession(session: number) {
    return session === battleSessionRef.current && getStore().hasActiveBattle;
  }

  function runIfSessionActive<T>(session: number, fn: () => T, fallback: T): T;
  function runIfSessionActive<T>(session: number, fn: () => T): T | undefined;
  function runIfSessionActive<T>(session: number, fn: () => T, fallback?: T): T | undefined {
    if (session === battleSessionRef.current && getStore().hasActiveBattle) {
      return fn();
    }
    return fallback;
  }

  function handleVictoryDefeat(kind: "victory" | "defeat") {
    if (!victoryDefeatHandledRef.current) {
      victoryDefeatHandledRef.current = true;
      if (kind === "victory") onBattleVictory?.();
      else onBattleDefeat?.();
    }
  }

  function checkBattleEnd(state: BattleState, session: number): boolean {
    if (!isCurrentBattleSession(session)) return false;
    if (isPlayerDefeated(state)) {
      handleVictoryDefeat("defeat");
      return true;
    }
    if (state.enemyHealth <= 0) {
      handleVictoryDefeat("victory");
      return true;
    }
    return false;
  }

  function registerTransferCancelCallback(callback: () => void) {
    return transferCancelRegistryRef.current.register(callback);
  }

  function clearTransferHandles() {
    transferCancelRegistryRef.current.cancelAll();
  }

  function finishDrawSequence(session: number, state: BattleState) {
    runIfSessionActive(session, () => {
      cardPlayInProgressRef.current = false;
      setCardTransferInProgress(false);
      setHiddenHandCardKeys(new Set());
      checkBattleEnd(state, session);
    });
  }

  function clearPendingBattleTimeouts() {
    battleTimerGroupRef.current.clearAll();
    companionScheduledRef.current = false;
  }

  function stopBattleFeedback() {
    stopAllSfx();
  }

  // ─── Effects ───
  useEffect(
    () => () => {
      clearPendingBattleTimeouts();
      clearTransferHandles();
      resolvedAsHasteOrStunRef.current = false;
    },
    [],
  );

  useEffect(() => {
    if (hasActiveBattle) return;
    invalidateBattleSession();
    clearPendingBattleTimeouts();
    clearTransferHandles();
    cardPlayInProgressRef.current = false;
    getStore().setBattleStartState(null);
    // hasActiveBattle is the only lifecycle edge this cleanup should react to.
  }, [hasActiveBattle]);

  const playerCombatTexts = useMemo(
    () => floatingCombatTexts.filter((e) => e.target === "player"),
    [floatingCombatTexts],
  );
  const enemyCombatTexts = useMemo(
    () => floatingCombatTexts.filter((e) => e.target === "enemy"),
    [floatingCombatTexts],
  );
  const { scheduleAutoEndTurn } = useBattleAutoEndTurn({ autoEndTurn, screen, battleState, onEndTurn: handleEndTurn });

  // ─── Card transfer animation helpers ───
  function getStore() {
    return useBattleStore.getState();
  }

  function playTransferSound(delay = 0) {
    if (!getStore().hasActiveBattle) return;
    playBattleEvent("drawTransfer", { volume: CARD_TRANSFER_CONFIG.soundVolume, delay });
  }

  function localRectFromElement(element: HTMLElement | null): CardRect | null {
    return measureElementRect(element, battleSceneRef.current);
  }

  function localVisualCardRect(element: HTMLElement | null): CardRect | null {
    return measureVisualCardRect(element, battleSceneRef.current);
  }

  function runCardTransfer(transfer: Omit<CardTransfer, "id">, onComplete?: () => void): Promise<void> {
    return new Promise((resolve) => {
      transferIdCounterRef.current += 1;
      const id = `transfer-${transferIdCounterRef.current}`;
      let completed = false;
      let unregisterCancel = () => {};
      const finish = (completeTransfer: boolean) => {
        if (completed) return;
        completed = true;
        unregisterCancel();
        setCardTransfers((current) => current.filter((item) => item.id !== id));
        if (completeTransfer) onComplete?.();
        resolve();
      };
      unregisterCancel = registerTransferCancelCallback(() => finish(false));
      setCardTransfers([{ ...transfer, id }]);
      delay(Math.round(transfer.duration * 1000) + CARD_TRANSFER_CONFIG.completionBufferMs).then(() => finish(true));
    });
  }

  // Helper to determine if a card's measured layout rect has stabilized.
  // Prevents measuring mid-animation before cards settle in the hand fan layout.
  function isRectStable(rect: CardRect, lastRect: CardRect | null): boolean {
    if (!lastRect) return false;
    return (
      Math.abs(rect.x - lastRect.x) < CARD_TRANSFER_CONFIG.rectEpsilonPx &&
      Math.abs(rect.y - lastRect.y) < CARD_TRANSFER_CONFIG.rectEpsilonPx
    );
  }

  function waitForStableHandCardRect(cardKey: string, fallback: CardRect): Promise<CardRect> {
    return new Promise((resolve) => {
      let frameCount = 0;
      let stableFrames = 0;
      let lastRect: CardRect | null = null;
      let completed = false;
      let unregisterCancel = () => {};
      let measureFrame: number | null = null;

      const finish = (rect: CardRect) => {
        if (completed) return;
        completed = true;
        unregisterCancel();
        if (measureFrame !== null) cancelAnimationFrame(measureFrame);
        resolve(rect);
      };

      unregisterCancel = registerTransferCancelCallback(() => {
        finish(localVisualCardRect(handCardRefs.current[cardKey]) ?? fallback);
      });

      delay(CARD_TRANSFER_CONFIG.stableRectTimeoutMs).then(() => {
        finish(localVisualCardRect(handCardRefs.current[cardKey]) ?? fallback);
      });

      function tick() {
        measureFrame = null;
        frameCount += 1;

        // Measure the visual DOM rect of the card in flight/hand.
        const rect = localVisualCardRect(handCardRefs.current[cardKey]) ?? fallback;

        // Check if layout rect matches the last frame within an epsilon.
        // We do this to ensure we don't start the card transfer animation from an incorrect
        // intermediate position while the React component is repositioning/stretching.
        if (isRectStable(rect, lastRect)) {
          stableFrames += 1;
        } else {
          stableFrames = 0;
        }
        lastRect = rect;

        // Once the card coordinates remain stable for enough frames (indicating they have
        // settled into their slot in the hand fan layout), or if we hit the max frame limit,
        // we finalize the coordinates to draw smooth card deals.
        if (
          stableFrames >= CARD_TRANSFER_CONFIG.requiredStableSlotFrames ||
          frameCount >= CARD_TRANSFER_CONFIG.maxSlotStabilizeFrames
        ) {
          finish(rect);
          return;
        }

        measureFrame = requestAnimationFrame(tick);
      }

      measureFrame = requestAnimationFrame(tick);
    });
  }

  async function animateDiscardedHand(cards: BattleCard[], session: number) {
    const discardPileRect = localRectFromElement(discardPileRef.current);
    if (!discardPileRect || cards.length === 0) return;
    const speedMul = getCardTransferBatchSpeed(cards.length);
    const cardInterval =
      ((CARD_TRANSFER_CONFIG.discardDurationSeconds / speedMul) * 1000 + CARD_TRANSFER_CONFIG.completionBufferMs) /
      1000;
    for (let i = 0; i < cards.length; i++) {
      if (!isCurrentBattleSession(session)) return;
      playTransferSound(i * cardInterval);
    }
    setCardTransferInProgress(true);
    cardPlayInProgressRef.current = true;
    for (let index = cards.length - 1; index >= 0; index -= 1) {
      if (!isCurrentBattleSession(session)) return;
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
        rotateY: [...CARD_TRANSFER_CONFIG.discardFlipKeyframes],
        duration: CARD_TRANSFER_CONFIG.discardDurationSeconds / speedMul,
      });
    }
  }

  async function animateDrawnHand(cards: BattleCard[], allHandCards: BattleCard[], session: number) {
    const drawPileRect = localRectFromElement(drawPileRef.current);
    if (!drawPileRect || cards.length === 0) return;
    const speedMul = getCardTransferBatchSpeed(cards.length);
    const cardInterval =
      ((CARD_TRANSFER_CONFIG.drawDurationSeconds / speedMul) * 1000 + CARD_TRANSFER_CONFIG.completionBufferMs) / 1000;
    for (let i = 0; i < cards.length; i++) {
      if (!isCurrentBattleSession(session)) return;
      playTransferSound(i * cardInterval);
    }
    for (const card of cards) {
      if (!isCurrentBattleSession(session)) return;
      const index = allHandCards.findIndex((item) => item.uid === card.uid && item.id === card.id);
      const cardKey = getCardKey(card);
      const fallbackRect = centeredRectForSize(drawPileRect, drawPileRect.width, drawPileRect.height);
      const targetRect = await waitForStableHandCardRect(cardKey, fallbackRect);
      if (!isCurrentBattleSession(session)) return;
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
          rotateY: [...CARD_TRANSFER_CONFIG.drawFlipKeyframes],
          duration: CARD_TRANSFER_CONFIG.drawDurationSeconds / speedMul,
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

  // ─── Battle start / initialization ───
  function startBattle(
    deck: BattleCard[] = run.runDeck,
    gold: number = run.runGold,
    enemyType: "normal" | "elite" = "normal",
    modifiers?: DifficultyModifier[],
  ) {
    beginBattle(getCurrentEnemy(enemyType, useRunStore.getState().encounteredRunEnemyIds), deck, gold, modifiers);
  }

  function startBossBattle(modifiers?: DifficultyModifier[]) {
    beginBattle(getBossEnemy(useRunStore.getState().encounteredRunEnemyIds), run.runDeck, run.runGold, modifiers);
  }

  function startBossById(bossId: string, modifiers?: DifficultyModifier[]): boolean {
    const boss = getBossById(bossId);
    if (!boss) {
      console.warn(`startBossById: boss "${bossId}" not found`);
      return false;
    }
    beginBattle(boss, run.runDeck, run.runGold, modifiers);
    return true;
  }

  function beginBattle(enemy: BestiaryEntry, deck: BattleCard[], gold: number, modifiers?: DifficultyModifier[]) {
    invalidateBattleSession();
    clearPendingBattleTimeouts();
    clearTransferHandles();
    stopBattleFeedback();
    setCardTransfers([]);
    setHiddenHandCardKeys(new Set());
    setCardTransferInProgress(false);
    cardPlayInProgressRef.current = false;
    victoryDefeatHandledRef.current = false;
    getStore().clearRevealedCardKeys();
    const startingHealth = getBattleStartPlayerHealth(run.runPlayerHealth, run.runMaxHealth, run.runTrinkets);
    run.setRunPlayerHealth(startingHealth);
    const nextRoomsEncountered = run.roomsEncountered + 1;
    run.setRoomsEncountered(nextRoomsEncountered);
    getStore().clearCardGhosts();
    const nextBattleState = createBattleForEnemy(enemy, deck, gold, startingHealth, nextRoomsEncountered, modifiers);
    getStore().setBattleState(nextBattleState);
    getStore().setBattleStartState(nextBattleState);
    getStore().setHasActiveBattle(true);
    run.setEncounteredRunEnemyIds((current) => appendUnique(current, enemy.id));
    setEncounteredEnemyIds((current) => appendUnique(current, enemy.id));
  }

  function createBattleForEnemy(
    enemy: BestiaryEntry,
    deck: BattleCard[],
    gold: number,
    playerHealth: number,
    roomsEncountered: number,
    modifiers?: DifficultyModifier[],
  ) {
    const mergedEffects = mergeIntoManifest(talents.talentEffects, homesteadEffectsRef.current);
    const activeModifiers =
      modifiers ?? (run.selectedDifficulty ? getDifficultyModifiers(run.characterId, run.selectedDifficulty) : []);
    return createBattleState({
      runDeck: deck,
      gold,
      totalRooms: roomsEncountered,
      currentEnemy: enemy,
      playerHealth,
      talentEffects: mergedEffects,
      discoveredCardIds,
      maxHealth: run.runMaxHealth,
      trinketIds: run.runTrinkets,
      difficultyModifiers: activeModifiers,
    });
  }

  // ─── Card play & draw sequence ───
  function detectNewHandCards(oldHand: BattleCard[], newHand: BattleCard[]): BattleCard[] {
    const oldUidSet = new Set(oldHand.map((c) => c.uid));
    return newHand.filter((c) => !oldUidSet.has(c.uid));
  }

  // Shared draw-sequence lifecycle: diff hand, set hidden keys, wait for DOM commit, animate, cleanup.
  // Returns true when new cards were drawn and animated.
  async function handleDrawSequence(
    oldHand: BattleCard[],
    newState: BattleState,
    applyState: () => void,
    session = battleSessionRef.current,
  ): Promise<boolean> {
    if (!isCurrentBattleSession(session)) return false;
    const drawnCards = detectNewHandCards(oldHand, newState.hand);
    if (drawnCards.length === 0) {
      runIfSessionActive(session, () => {
        applyState();
        setCardTransferInProgress(false);
      });
      return false;
    }
    const hiddenDrawKeys = new Set(drawnCards.map(getCardKey));
    setCardTransferInProgress(true);
    runIfSessionActive(session, () => {
      setHiddenHandCardKeys(hiddenDrawKeys);
      applyState();
    });
    // Wait for React to commit state changes to the DOM before measuring card positions
    await new Promise((resolve) => requestAnimationFrame(resolve));
    try {
      if (!isAnimationDisabled()) {
        await animateDrawnHand(drawnCards, newState.hand, session);
      }
    } finally {
      runIfSessionActive(session, () => {
        setCardTransferInProgress(false);
        setHiddenHandCardKeys((current) => {
          const next = new Set(current);
          for (const key of hiddenDrawKeys) {
            next.delete(key);
          }
          return next;
        });
      });
    }
    return isCurrentBattleSession(session);
  }

  function handlePlayCard(
    card: BattleCard,
    index: number,
    sourceRect: { x: number; y: number; width: number; height: number },
  ) {
    const currentState = getStore().battleState;
    if (!canPlayCard(card, index, currentState)) return;
    const session = battleSessionRef.current;
    cardPlayInProgressRef.current = true;
    animatePlayedCard(card, index, sourceRect);
    playCardSound(card.id);
    const resolution = playBattleCardResolved(currentState, card.id, index);
    playCardResolutionFeedback(card, resolution.state, resolution.combatTexts);
    setHoveredCardId((current) => (current === getHoverId("hand", `${card.id}-${card.uid}`) ? null : current));
    talents.awardCardXP(card);

    void handleDrawSequence(
      currentState.hand,
      resolution.state,
      () => {
        getStore().setBattleState(resolution.state);
        if (resolution.combatTexts.length > 0) getStore().showCombatTexts(resolution.combatTexts);
      },
      session,
    )
      .catch((err) => {
        logError(
          "Failed to handle play card draw sequence",
          "battle",
          { error: String(err) },
          err instanceof Error ? err.stack : undefined,
        );
      })
      .finally(() => finishDrawSequence(session, resolution.state));
    runIfSessionActive(session, () => {
      scheduleAutoEndTurn(resolution.state);
    });
  }

  function canPlayCard(card: BattleCard, index: number, state: BattleState) {
    const currentCard = state.hand[index];
    return (
      screen === "battle" &&
      state.enemyHealth > 0 &&
      !isPlayerDefeated(state) &&
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
    const session = battleSessionRef.current;
    setDiscoveredCardIds((current) => appendUnique(current, card.id));
    void handleDrawSequence(
      currentState.hand,
      newState,
      () => {
        getStore().setBattleState(newState);
      },
      session,
    )
      .catch((err) => {
        logError(
          "Failed to handle wish choice draw sequence",
          "battle",
          { error: String(err) },
          err instanceof Error ? err.stack : undefined,
        );
      })
      .finally(() => finishDrawSequence(session, newState));
  }

  // ─── End turn & enemy phase ───
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
    clearPendingBattleTimeouts();
    const session = battleSessionRef.current;

    animateEndTurnThenResolve(currentState, session).catch((err) => {
      logError(
        "Failed to resolve end turn animation sequence",
        "battle",
        { error: String(err) },
        err instanceof Error ? err.stack : undefined,
      );
    });
  }

  async function animateEndTurnThenResolve(currentState: BattleState, session: number) {
    try {
      if (!isAnimationDisabled()) {
        try {
          await animateDiscardedHand(currentState.hand, session);
        } catch (err) {
          logError(
            "Discard hand animation failed",
            "battle",
            { error: String(err) },
            err instanceof Error ? err.stack : undefined,
          );
        }
      }
      runIfSessionActive(session, () => {
        resolveEndTurn(currentState, session);
      });
    } finally {
      runIfSessionActive(session, () => {
        if (!resolvedAsHasteOrStunRef.current) {
          setHiddenHandCardKeys(new Set());
          setCardTransferInProgress(false);
        }
        cardPlayInProgressRef.current = false;
      });
    }
  }

  const resolvedAsHasteOrStunRef = useRef(false);

  // Helper to handle the "Haste" skip-turn resolution.
  // Immediately advances the turn sequence to the player's next turn without running enemy attack phases.
  function resolveHasteSkipTurn(
    result: ReturnType<typeof endPlayerTurn>,
    companionState: BattleState,
    session: number,
  ) {
    // Set a flag to bypass cleaning up card play references and hand card visual hidden keys.
    // This allows the draw sequence animation to animate smoothly directly into the next turn.
    resolvedAsHasteOrStunRef.current = true;
    if (result.combatTexts.length > 0) getStore().showCombatTexts(result.combatTexts);

    // Draw cards for the player's next turn immediately since the enemy phase is skipped.
    void handleDrawSequence(
      companionState.hand,
      result.state,
      () => {
        getStore().setBattleState(result.state);
      },
      session,
    )
      .catch((err) => {
        logError(
          "Failed to handle end turn draw sequence",
          "battle",
          { error: String(err) },
          err instanceof Error ? err.stack : undefined,
        );
      })
      .finally(() => {
        runIfSessionActive(session, () => {
          resolvedAsHasteOrStunRef.current = false;
          setHiddenHandCardKeys(new Set());
          setCardTransferInProgress(false);
          cardPlayInProgressRef.current = false;

          // Check if any DoT status ticks or companion triggers ended the battle.
          if (checkBattleEnd(result.state, session)) return;

          // If player's turn is immediately skipped (e.g., they are Stunned/Frozen),
          // loop back to resolveEndTurn to transition directly to the enemy turn.
          if (result.playerTurnSkipped) {
            resolveEndTurn(result.state, session);
            return;
          }

          // If player can act, trigger companion actions for their turn start.
          scheduleCompanionFollowUp(result.state, session);
        });
      });
  }

  // Helper to resolve the standard enemy turn phase transition.
  // Displays enemy-turn startup texts, updates state, and kicks off enemy attack execution.
  function resolveNormalEnemyTurn(
    result: ReturnType<typeof endPlayerTurn>,
    companionResult: { state: BattleState; combatTexts: CombatTextEvent[] },
    session: number,
  ) {
    // Merge combat texts: start-of-enemy-turn dot ticks + companion triggers.
    const enemyTurnStartTexts = result.enemyTurnStartState
      ? [...companionResult.combatTexts, ...result.enemyTurnStartCombatTexts]
      : [...companionResult.combatTexts, ...result.combatTexts];

    // Determine which combat texts correspond to enemy resolution actions.
    const enemyResolutionTexts = result.enemyTurnStartState ? result.enemyResolutionCombatTexts : result.combatTexts;

    // Transition the visual UI state to the enemy turn.
    // In this display state, we clear the player's hand cards in the UI since it is the enemy's phase.
    showEnemyTurnStart(
      result.enemyTurnStartState ?? result.state,
      companionResult.state,
      enemyTurnStartTexts,
      Boolean(result.enemyTurnStartState),
    );

    // Check if the enemy died from start-of-turn dot statuses (e.g., Poison/Burn).
    if (result.state.enemyHealth <= 0) {
      getStore().setBattleState({ ...result.state, turnPhase: "enemy", hand: [] });
      handleVictoryDefeat("victory");
      return;
    }

    // Verify that player is still alive before executing the enemy phase.
    if (checkBattleEnd(result.state, session)) return;

    // Execute enemy attack animations, DoT resolution, and player damage indicators.
    void executeEnemyPhase(
      result.state,
      companionResult.state,
      enemyResolutionTexts,
      session,
      result.playerTurnSkipped,
      result.enemyPerformedAttack,
    );
  }

  function resolveEndTurn(currentState: BattleState, session: number) {
    try {
      runIfSessionActive(session, () => {
        const companionResult = resolveQueuedCompanionTurn(currentState);

        if (companionResult.state.enemyHealth <= 0) {
          getStore().setBattleState(companionResult.state);
          if (companionResult.combatTexts.length > 0) getStore().showCombatTexts(companionResult.combatTexts);
          handleVictoryDefeat("victory");
          return;
        }
        if (isPlayerDefeated(companionResult.state)) {
          handleVictoryDefeat("defeat");
          return;
        }

        const result = endPlayerTurn(companionResult.state);

        // Haste skip: immediately show the next turn and animate any draw
        // (enemyTurnStartState is undefined only in the haste path)
        if (!result.enemyTurnStartState) {
          resolveHasteSkipTurn(result, companionResult.state, session);
          return;
        }

        resolveNormalEnemyTurn(result, companionResult, session);
      });
    } catch (err) {
      logError(
        "Unhandled error in resolveEndTurn, triggering defeat",
        "battle",
        { error: String(err) },
        err instanceof Error ? err.stack : undefined,
      );
      if (isCurrentBattleSession(session)) {
        handleVictoryDefeat("defeat");
      }
    }
  }

  function triggerCompanionEffects(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
    if (state.activeCompanion) {
      playCompanionSound(state.activeCompanion.id);
      getStore().shakeCompanion();
      return processCompanionTurnStart(state, combatTexts);
    }
    return state;
  }

  function resolveQueuedCompanionTurn(state: BattleState) {
    const combatTexts: CombatTextEvent[] = [];
    if (companionScheduledRef.current && state.activeCompanion) {
      const nextState = triggerCompanionEffects(state, combatTexts);
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

  // Helper to finish the enemy phase once the attack execution and draw sequence animations conclude.
  function finishEnemyPhase(resultState: BattleState, session: number, playerTurnSkipped: boolean) {
    if (checkBattleEnd(resultState, session)) return;
    if (playerTurnSkipped) {
      resolveEndTurn(resultState, session);
      return;
    }
    scheduleCompanionFollowUp(resultState, session);
  }

  async function executeEnemyPhase(
    resultState: BattleState,
    currentState: BattleState,
    combatTexts: CombatTextEvent[],
    session: number,
    playerTurnSkipped: boolean,
    enemyPerformedAttack: boolean,
  ) {
    const playerTexts = combatTexts.filter((ct) => ct.target === "player");
    await delay(ENEMY_PHASE_DELAY);
    if (!isCurrentBattleSession(session)) return;
    if (enemyPerformedAttack) playEnemyAttack(currentState.currentEnemy.id);
    if (!currentState.deathsDoorActive && resultState.deathsDoorActive) playBattleEvent("deathsDoor");
    if (combatTexts.length > 0) getStore().showCombatTexts(combatTexts);
    if (shouldShakePlayerFromCombatTexts(playerTexts)) getStore().shakePlayer();
    await delay(ENEMY_ATTACK_RECOVERY_DELAY);
    if (!isCurrentBattleSession(session)) return;
    try {
      await handleDrawSequence(
        currentState.hand,
        resultState,
        () => {
          getStore().setBattleState(resultState);
        },
        session,
      );
    } catch (err) {
      logError(
        "Failed to handle enemy resolution draw sequence",
        "battle",
        { error: String(err) },
        err instanceof Error ? err.stack : undefined,
      );
    }
    if (!isCurrentBattleSession(session)) return;
    finishEnemyPhase(resultState, session, playerTurnSkipped);
  }

  function scheduleCompanionFollowUp(resultState: BattleState, session: number) {
    if (!resultState.activeCompanion || resultState.enemyHealth <= 0) return;
    battleTimerGroupRef.current.setTimeout(() => {
      runIfSessionActive(session, () => {
        companionScheduledRef.current = false;
        const texts = resolveCompanionFollowUpTexts(session);
        if (texts.length > 0) getStore().showCombatTexts(texts);
      });
    }, COMPANION_ATTACK_DELAY);
    companionScheduledRef.current = true;
  }

  function resolveCompanionFollowUpTexts(session: number) {
    return runIfSessionActive(session, () => {
      const store = getStore();
      const texts: CombatTextEvent[] = [];
      const newState = triggerCompanionEffects(store.battleState, texts);
      store.setBattleState(newState);
      return texts;
    }, []);
  }

  // ─── Run end / dev mode ───
  function handleEndRun() {
    if (screen !== "battle") return;
    invalidateBattleSession();
    clearPendingBattleTimeouts();
    clearTransferHandles();
    stopBattleFeedback();
    getStore().setBattleState((c) => ({
      ...c,
      playerHealth: 0,
      deathsDoorUsed: true,
      deathsDoorActive: false,
      deathsDoorTriggeredTurn: null,
    }));
    handleVictoryDefeat("defeat");
  }

  function skipCombatDevMode() {
    if (screen === "battle") {
      invalidateBattleSession();
      clearPendingBattleTimeouts();
      clearTransferHandles();
      stopBattleFeedback();
      getStore().setBattleState((c) => ({ ...c, enemyHealth: 0, wishOptions: null, wishQueue: [] }));
      handleVictoryDefeat("victory");
    }
  }

  return {
    battleState,
    battleStartState,
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
    maybeTriggerShimmer: useScreenStore.getState().maybeTriggerShimmer,
    clearCardGhosts: getStore().clearCardGhosts,
  };
}
