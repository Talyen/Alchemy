// React battle orchestrator for combat state, card play, turn timing, ghosts, and feedback.
// Depends on pure battle logic, run/talent state, homestead modifiers, audio, and UI hooks.
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
import { animateCardActivation } from "./battle/card-ghost-animation";
import { getBossById, getCurrentEnemy, getBossEnemy } from "./config";
import type { CardRect, CardTransfer, Screen } from "./types";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import {
  CARD_ACTIVATION_ROTATION_DEGREES,
  CARD_TRANSFER_CONFIG,
  ENEMY_ATTACK_RECOVERY_DELAY,
  COMPANION_ATTACK_DELAY,
  ENEMY_PHASE_DELAY,
  HAND_FAN_ROTATION_DEGREES,
  isAnimationDisabled,
  ANIMATION_DISABLED_DURATION,
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
import { useRunStore } from "./stores/run-store";
import { useScreenStore } from "./stores/screen-store";
import { getBattleStartPlayerHealth } from "./battle/battle-start";
import { createTransferCancelRegistry } from "./battle/transfer-lifecycle";
import {
  defaultMeasureElementRect,
  defaultMeasureVisualCardRect,
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
  const companionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enemyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const companionScheduledRef = useRef(false);
  const battleSessionRef = useRef(0);
  const victoryDefeatHandledRef = useRef(false);
  const transferCancelRegistryRef = useRef(createTransferCancelRegistry());
  const [cardTransfers, setCardTransfers] = useState<CardTransfer[]>([]);
  const [hiddenHandCardKeys, setHiddenHandCardKeys] = useState<Set<string>>(new Set());
  const [cardTransferInProgress, setCardTransferInProgress] = useState(false);

  // ─── Session lifecycle ───
  function invalidateBattleSession() {
    battleSessionRef.current += 1;
  }

  function isCurrentBattleSession(session: number) {
    return session === battleSessionRef.current && getStore().hasActiveBattle;
  }

  function runIfSessionActive<T>(session: number, fn: () => T, fallback?: T): T {
    if (session === battleSessionRef.current && getStore().hasActiveBattle) {
      return fn();
    }
    return fallback as T;
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
    transferCancelRegistryRef.current.cancelAll();
  }

  function clearPendingBattleTimeouts() {
    clearCompanionTimeout();
    clearEnemyTimeout();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function getCardKey(card: BattleCard) {
    return `${card.id}-${card.uid}`;
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
      let completed = false;
      let unregisterCancel = () => {};
      let timeout: ReturnType<typeof setTimeout> | null = null;
      const finish = (completeTransfer: boolean) => {
        if (completed) return;
        completed = true;
        unregisterCancel();
        if (timeout) clearTimeout(timeout);
        setCardTransfers((current) => current.filter((item) => item.id !== id));
        if (completeTransfer) onComplete?.();
        console.log("[flying] remove", id);
        resolve();
      };
      unregisterCancel = registerTransferCancelCallback(() => finish(false));
      setCardTransfers([{ ...transfer, id }]);
      console.log("[flying] create", id);
      timeout = setTimeout(
        () => finish(true),
        isAnimationDisabled()
          ? ANIMATION_DISABLED_DURATION
          : Math.round(transfer.duration * 1000) + CARD_TRANSFER_CONFIG.completionBufferMs,
      );
    });
  }

  function waitForStableHandCardRect(cardKey: string, fallback: CardRect): Promise<CardRect> {
    return new Promise((resolve) => {
      let frameCount = 0;
      let stableFrames = 0;
      let lastRect: CardRect | null = null;
      let completed = false;
      let unregisterCancel = () => {};
      let safetyTimer: ReturnType<typeof setTimeout> | null = null;
      let measureFrame: number | null = null;

      const finish = (rect: CardRect) => {
        if (completed) return;
        completed = true;
        unregisterCancel();
        if (safetyTimer !== null) clearTimeout(safetyTimer);
        if (measureFrame !== null) cancelAnimationFrame(measureFrame);
        resolve(rect);
      };

      unregisterCancel = registerTransferCancelCallback(() => {
        finish(localVisualCardRect(handCardRefs.current[cardKey]) ?? fallback);
      });

      safetyTimer = setTimeout(() => {
        finish(localVisualCardRect(handCardRefs.current[cardKey]) ?? fallback);
      }, CARD_TRANSFER_CONFIG.stableRectTimeoutMs);

      function tick() {
        measureFrame = null;
        frameCount += 1;
        const rect = localVisualCardRect(handCardRefs.current[cardKey]) ?? fallback;
        if (
          lastRect &&
          Math.abs(rect.x - lastRect.x) < CARD_TRANSFER_CONFIG.rectEpsilonPx &&
          Math.abs(rect.y - lastRect.y) < CARD_TRANSFER_CONFIG.rectEpsilonPx
        ) {
          stableFrames += 1;
        } else {
          stableFrames = 0;
        }
        lastRect = rect;

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

  async function animateDiscardedHand(cards: BattleCard[]) {
    const discardPileRect = localRectFromElement(discardPileRef.current);
    if (!discardPileRect || cards.length === 0) return;
    const speedMul = getCardTransferBatchSpeed(cards.length);
    const cardInterval =
      ((CARD_TRANSFER_CONFIG.discardDurationSeconds / speedMul) * 1000 + CARD_TRANSFER_CONFIG.completionBufferMs) /
      1000;
    for (let i = 0; i < cards.length; i++) playTransferSound(i * cardInterval);
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
        rotateY: [...CARD_TRANSFER_CONFIG.discardFlipKeyframes],
        duration: CARD_TRANSFER_CONFIG.discardDurationSeconds / speedMul,
      });
    }
  }

  async function animateDrawnHand(cards: BattleCard[], allHandCards: BattleCard[]) {
    const drawPileRect = localRectFromElement(drawPileRef.current);
    if (!drawPileRect || cards.length === 0) return;
    const speedMul = getCardTransferBatchSpeed(cards.length);
    const cardInterval =
      ((CARD_TRANSFER_CONFIG.drawDurationSeconds / speedMul) * 1000 + CARD_TRANSFER_CONFIG.completionBufferMs) / 1000;
    for (let i = 0; i < cards.length; i++) playTransferSound(i * cardInterval);
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
        await animateDrawnHand(drawnCards, newState.hand);
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
    getStore().showCombatTexts(resolution.combatTexts);
    setHoveredCardId((current) => (current === getHoverId("hand", `${card.id}-${card.uid}`) ? null : current));
    talents.awardCardXP(card);

    void handleDrawSequence(
      currentState.hand,
      resolution.state,
      () => {
        getStore().setBattleState(resolution.state);
      },
      session,
    )
      .catch((err) => {
        console.error("Failed to handle play card draw sequence:", err);
      })
      .finally(() => {
        runIfSessionActive(session, () => {
          cardPlayInProgressRef.current = false;
          setCardTransferInProgress(false);
          setHiddenHandCardKeys(new Set());
          checkBattleEnd(resolution.state, session);
        });
      });
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
        console.error("Failed to handle wish choice draw sequence:", err);
      })
      .finally(() => {
        runIfSessionActive(session, () => {
          setCardTransferInProgress(false);
          setHiddenHandCardKeys(new Set());
          checkBattleEnd(newState, session);
        });
      });
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
    clearCompanionTimeout();
    const session = battleSessionRef.current;

    animateEndTurnThenResolve(currentState, session).catch((err) => {
      console.error("Failed to resolve end turn animation sequence:", err);
    });
  }

  async function animateEndTurnThenResolve(currentState: BattleState, session: number) {
    try {
      if (!isAnimationDisabled()) {
        try {
          await animateDiscardedHand(currentState.hand);
        } catch (err) {
          console.error("Discard hand animation failed:", err);
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
          resolvedAsHasteOrStunRef.current = true;
          if (result.combatTexts.length > 0) getStore().showCombatTexts(result.combatTexts);
          void handleDrawSequence(
            companionResult.state.hand,
            result.state,
            () => {
              getStore().setBattleState(result.state);
            },
            session,
          )
            .catch((err) => {
              console.error("Failed to handle end turn draw sequence:", err);
            })
            .finally(() => {
              runIfSessionActive(session, () => {
                resolvedAsHasteOrStunRef.current = false;
                setHiddenHandCardKeys(new Set());
                setCardTransferInProgress(false);
                cardPlayInProgressRef.current = false;
                if (checkBattleEnd(result.state, session)) return;
                if (result.playerTurnSkipped) {
                  resolveEndTurn(result.state, session);
                  return;
                }
                scheduleCompanionFollowUp(result.state, session);
              });
            });
          return;
        }

        const enemyTurnStartTexts = result.enemyTurnStartState
          ? [...companionResult.combatTexts, ...result.enemyTurnStartCombatTexts]
          : [...companionResult.combatTexts, ...result.combatTexts];
        const enemyResolutionTexts = result.enemyTurnStartState
          ? result.enemyResolutionCombatTexts
          : result.combatTexts;

        showEnemyTurnStart(
          result.enemyTurnStartState ?? result.state,
          companionResult.state,
          enemyTurnStartTexts,
          Boolean(result.enemyTurnStartState),
        );
        if (result.state.enemyHealth <= 0) {
          getStore().setBattleState({ ...result.state, turnPhase: "enemy", hand: [] });
          handleVictoryDefeat("victory");
          return;
        }
        if (checkBattleEnd(result.state, session)) return;
        scheduleEnemyTurnResolution(
          result.state,
          companionResult.state,
          enemyResolutionTexts,
          session,
          result.playerTurnSkipped,
          result.enemyPerformedAttack,
        );
      });
    } catch (err) {
      console.error("Unhandled error in resolveEndTurn, triggering defeat:", err);
      if (isCurrentBattleSession(session)) {
        handleVictoryDefeat("defeat");
      }
    }
  }

  function resolveQueuedCompanionTurn(state: BattleState) {
    const combatTexts: CombatTextEvent[] = [];
    if (companionScheduledRef.current && state.activeCompanion) {
      playCompanionSound(state.activeCompanion.id);
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
    session: number,
    playerTurnSkipped: boolean,
    enemyPerformedAttack: boolean,
  ) {
    const playerTexts = combatTexts.filter((ct) => ct.target === "player");
    clearEnemyTimeout();
    const phaseDelay = isAnimationDisabled() ? ANIMATION_DISABLED_DURATION : ENEMY_PHASE_DELAY;
    const recoveryDelay = isAnimationDisabled() ? ANIMATION_DISABLED_DURATION : ENEMY_ATTACK_RECOVERY_DELAY;
    enemyTimeoutRef.current = setTimeout(() => {
      enemyTimeoutRef.current = null;
      runIfSessionActive(session, () => {
        if (enemyPerformedAttack) playEnemyAttack(currentState.currentEnemy.id);
        if (!currentState.deathsDoorActive && resultState.deathsDoorActive) playBattleEvent("deathsDoor");
        if (combatTexts.length > 0) getStore().showCombatTexts(combatTexts);
        if (shouldShakePlayerFromCombatTexts(playerTexts)) getStore().shakePlayer();
        enemyTimeoutRef.current = setTimeout(() => {
          enemyTimeoutRef.current = null;
          runIfSessionActive(session, () => {
            void handleDrawSequence(
              currentState.hand,
              resultState,
              () => {
                getStore().setBattleState(resultState);
              },
              session,
            )
              .catch((err) => {
                console.error("Failed to handle enemy resolution draw sequence:", err);
              })
              .finally(() => {
                runIfSessionActive(session, () => {
                  if (checkBattleEnd(resultState, session)) return;
                  if (playerTurnSkipped) {
                    resolveEndTurn(resultState, session);
                    return;
                  }
                  scheduleCompanionFollowUp(resultState, session);
                });
              });
          });
        }, recoveryDelay);
      });
    }, phaseDelay);
  }

  function scheduleCompanionFollowUp(resultState: BattleState, session: number) {
    if (!resultState.activeCompanion || resultState.enemyHealth <= 0) return;
    const companionDelay = isAnimationDisabled() ? ANIMATION_DISABLED_DURATION : COMPANION_ATTACK_DELAY;
    companionTimeoutRef.current = setTimeout(() => {
      companionTimeoutRef.current = null;
      companionScheduledRef.current = false;
      runIfSessionActive(session, () => {
        const texts = resolveCompanionFollowUpTexts(session);
        if (texts.length > 0) getStore().showCombatTexts(texts);
      });
    }, companionDelay);
    companionScheduledRef.current = true;
  }

  function resolveCompanionFollowUpTexts(session: number) {
    return runIfSessionActive(session, () => {
      const store = getStore();
      const texts: CombatTextEvent[] = [];
      if (store.battleState.activeCompanion) {
        playCompanionSound(store.battleState.activeCompanion.id);
      }
      const newState = processCompanionTurnStart(store.battleState, texts);
      store.setBattleState(newState);
      store.shakeCompanion();
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
