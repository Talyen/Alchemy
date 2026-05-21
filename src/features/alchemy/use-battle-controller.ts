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
import { playBattleEvent, playCardSound, playEnemyAttack, playGoldGain, stopAllSfx } from "@/lib/audio";
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
  CARD_TRANSFER_CONFIG,
  ENEMY_ATTACK_RECOVERY_DELAY,
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
import { createTransferCancelRegistry } from "./battle/transfer-lifecycle";

function getCardTransferBatchSpeed(cardCount: number) {
  const { batchSpeedMultipliers } = CARD_TRANSFER_CONFIG;
  if (cardCount <= batchSpeedMultipliers.smallMaxCardCount) return batchSpeedMultipliers.small;
  if (cardCount === batchSpeedMultipliers.mediumCardCount) return batchSpeedMultipliers.medium;
  return batchSpeedMultipliers.large;
}

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
  const battleSessionRef = useRef(0);
  const transferCancelRegistryRef = useRef(createTransferCancelRegistry());
  const [cardTransfers, setCardTransfers] = useState<CardTransfer[]>([]);
  const [hiddenHandCardKeys, setHiddenHandCardKeys] = useState<Set<string>>(new Set());
  const [cardTransferInProgress, setCardTransferInProgress] = useState(false);

  function invalidateBattleSession() {
    battleSessionRef.current += 1;
  }

  function isCurrentBattleSession(session: number) {
    return session === battleSessionRef.current && getStore().hasActiveBattle;
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
    if (transferTimeoutRef.current) clearTimeout(transferTimeoutRef.current);
    if (transferMeasureFrameRef.current !== null) cancelAnimationFrame(transferMeasureFrameRef.current);
    if (transferSafetyTimerRef.current !== null) clearTimeout(transferSafetyTimerRef.current);
    transferTimeoutRef.current = null;
    transferMeasureFrameRef.current = null;
    transferSafetyTimerRef.current = null;
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

  useEffect(() => {
    if (hasActiveBattle) return;
    invalidateBattleSession();
    clearPendingBattleTimeouts();
    clearTransferHandles();
    cardPlayInProgressRef.current = false;
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
      let completed = false;
      let unregisterCancel = () => {};
      let timeout: ReturnType<typeof setTimeout> | null = null;
      const finish = (completeTransfer: boolean) => {
        if (completed) return;
        completed = true;
        unregisterCancel();
        if (timeout) clearTimeout(timeout);
        if (transferTimeoutRef.current === timeout) {
          transferTimeoutRef.current = null;
        }
        if (import.meta.env.DEV) console.log("[flying] remove", id.slice(-8));
        setCardTransfers((current) => current.filter((item) => item.id !== id));
        if (completeTransfer) onComplete?.();
        resolve();
      };
      unregisterCancel = registerTransferCancelCallback(() => finish(false));
      if (import.meta.env.DEV) console.log("[flying] create", id.slice(-8));
      setCardTransfers([{ ...transfer, id }]);
      timeout = setTimeout(
        () => finish(true),
        Math.round(transfer.duration * 1000) + CARD_TRANSFER_CONFIG.completionBufferMs,
      );
      transferTimeoutRef.current = timeout;
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
        if (transferSafetyTimerRef.current === safetyTimer) {
          transferSafetyTimerRef.current = null;
        }
        if (measureFrame !== null) cancelAnimationFrame(measureFrame);
        if (transferMeasureFrameRef.current === measureFrame) {
          transferMeasureFrameRef.current = null;
        }
        resolve(rect);
      };

      unregisterCancel = registerTransferCancelCallback(() => {
        finish(localVisualCardRect(handCardRefs.current[cardKey]) ?? fallback);
      });

      safetyTimer = setTimeout(() => {
        finish(localVisualCardRect(handCardRefs.current[cardKey]) ?? fallback);
      }, CARD_TRANSFER_CONFIG.stableRectTimeoutMs);
      transferSafetyTimerRef.current = safetyTimer;

      function tick() {
        if (transferMeasureFrameRef.current === measureFrame) transferMeasureFrameRef.current = null;
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
        transferMeasureFrameRef.current = measureFrame;
      }

      measureFrame = requestAnimationFrame(tick);
      transferMeasureFrameRef.current = measureFrame;
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
          if (import.meta.env.DEV) {
            const btn = handCardRefs.current[cardKey];
            const overlay = document.querySelector("[data-flying-card]") as HTMLElement | null;
            if (btn && overlay) {
              const sceneRect = getBattleSceneLocalRect(battleSceneRef.current);
              if (sceneRect) {
                const br = btn.getBoundingClientRect();
                const or = overlay.getBoundingClientRect();
                const dx = Math.abs((br.left - or.left) / sceneRect.scaleX);
                const dy = Math.abs((br.top - or.top) / sceneRect.scaleY);
                const dw = Math.abs((br.width - or.width) / sceneRect.scaleX);
                const dh = Math.abs((br.height - or.height) / sceneRect.scaleY);
                if (
                  dx > CARD_TRANSFER_CONFIG.rectEpsilonPx ||
                  dy > CARD_TRANSFER_CONFIG.rectEpsilonPx ||
                  dw > CARD_TRANSFER_CONFIG.rectEpsilonPx ||
                  dh > CARD_TRANSFER_CONFIG.rectEpsilonPx
                ) {
                  console.warn(
                    `[snap] card=${cardKey} dx:${dx.toFixed(2)} dy:${dy.toFixed(2)} dw:${dw.toFixed(2)} dh:${dh.toFixed(2)}`,
                  );
                }
              }
            }
          }
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
  ) {
    beginBattle(getCurrentEnemy(enemyType), deck, gold, modifiers);
  }

  function startBossBattle(modifiers?: DifficultyModifier[]) {
    beginBattle(getBossEnemy(), run.runDeck, run.runGold, modifiers);
  }

  function startBossById(bossId: string, modifiers?: DifficultyModifier[]): boolean {
    const boss = getBossById(bossId);
    if (!boss) return false;
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
    getStore().clearRevealedCardKeys();
    const startingHealth = getBattleStartPlayerHealth(run.runPlayerHealth, run.runMaxHealth, run.runTrinkets);
    run.setRunPlayerHealth(startingHealth);
    const nextRoomsEncountered = run.roomsEncountered + 1;
    run.setRoomsEncountered(nextRoomsEncountered);
    getStore().clearCardGhosts();
    const nextBattleState = createBattleForEnemy(enemy, deck, gold, startingHealth, nextRoomsEncountered, modifiers);
    getStore().setBattleState(nextBattleState);
    getStore().setHasActiveBattle(true);
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
    return createBattleState(
      deck,
      gold,
      roomsEncountered,
      enemy,
      playerHealth,
      mergedEffects,
      discoveredCardIds,
      run.runMaxHealth,
      run.runTrinkets,
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
    session = battleSessionRef.current,
  ): Promise<boolean> {
    if (!isCurrentBattleSession(session)) return false;
    const drawnCards = detectNewHandCards(oldHand, newState.hand);
    if (drawnCards.length === 0) {
      if (!isCurrentBattleSession(session)) return false;
      flushSync(() => {
        if (!isCurrentBattleSession(session)) return;
        applyState();
        setCardTransferInProgress(false);
      });
      return false;
    }
    const hiddenDrawKeys = new Set(drawnCards.map(getCardKey));
    setCardTransferInProgress(true);
    flushSync(() => {
      if (!isCurrentBattleSession(session)) return;
      setHiddenHandCardKeys(hiddenDrawKeys);
      applyState();
    });
    await animateDrawnHand(drawnCards, newState.hand);
    if (!isCurrentBattleSession(session)) return false;
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
    ).finally(() => {
      if (isCurrentBattleSession(session)) cardPlayInProgressRef.current = false;
    });
    if (isCurrentBattleSession(session)) scheduleAutoEndTurn(resolution.state);
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
    const session = battleSessionRef.current;
    setDiscoveredCardIds((current) => appendUnique(current, card.id));
    void handleDrawSequence(
      currentState.hand,
      newState,
      () => {
        getStore().setBattleState(newState);
      },
      session,
    );
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
    const session = battleSessionRef.current;

    void animateEndTurnThenResolve(currentState, session);
  }

  async function animateEndTurnThenResolve(currentState: BattleState, session: number) {
    try {
      await animateDiscardedHand(currentState.hand);
      if (!isCurrentBattleSession(session)) return;
      resolveEndTurn(currentState, session);
    } finally {
      // haste/stun path manages its own transfer lifecycle; only clear if we didn't go there
      if (isCurrentBattleSession(session) && !resolvedAsHasteOrStunRef.current) {
        setHiddenHandCardKeys(new Set());
        setCardTransferInProgress(false);
        cardPlayInProgressRef.current = false;
      }
    }
  }

  const resolvedAsHasteOrStunRef = useRef(false);

  function resolveEndTurn(currentState: BattleState, session: number) {
    if (!isCurrentBattleSession(session)) return;
    const companionResult = resolveQueuedCompanionTurn(currentState);

    if (companionResult.state.enemyHealth <= 0) {
      if (!isCurrentBattleSession(session)) return;
      getStore().setBattleState(companionResult.state);
      if (companionResult.combatTexts.length > 0) getStore().showCombatTexts(companionResult.combatTexts);
      return;
    }

    const result = endPlayerTurn(companionResult.state);

    // Haste or stun skip: immediately show the next turn and animate any draw
    // (enemyTurnStartState is undefined in these paths)
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
      ).finally(() => {
        if (!isCurrentBattleSession(session)) return;
        resolvedAsHasteOrStunRef.current = false;
        if (result.playerTurnSkipped) {
          resolveEndTurn(result.state, session);
          return;
        }
        scheduleCompanionFollowUp(result.state, session);
      });
      return;
    }

    const enemyTurnStartTexts = result.enemyTurnStartState
      ? [...companionResult.combatTexts, ...result.enemyTurnStartCombatTexts]
      : [...companionResult.combatTexts, ...result.combatTexts];
    const enemyResolutionTexts = result.enemyTurnStartState ? result.enemyResolutionCombatTexts : result.combatTexts;

    if (!isCurrentBattleSession(session)) return;
    showEnemyTurnStart(
      result.enemyTurnStartState ?? result.state,
      companionResult.state,
      enemyTurnStartTexts,
      Boolean(result.enemyTurnStartState),
    );
    if (result.state.enemyHealth <= 0) {
      if (!isCurrentBattleSession(session)) return;
      getStore().setBattleState({ ...result.state, turnPhase: "enemy", hand: [] });
      return;
    }
    scheduleEnemyTurnResolution(
      result.state,
      companionResult.state,
      enemyResolutionTexts,
      session,
      result.playerTurnSkipped,
    );
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
    session: number,
    playerTurnSkipped: boolean,
  ) {
    const playerTexts = combatTexts.filter((ct) => ct.target === "player");
    clearEnemyTimeout();
    enemyTimeoutRef.current = setTimeout(() => {
      enemyTimeoutRef.current = null;
      if (!isCurrentBattleSession(session)) return;
      playEnemyAttack(currentState.currentEnemy.id);
      if (!currentState.deathsDoorActive && resultState.deathsDoorActive) playBattleEvent("deathsDoor");
      if (combatTexts.length > 0) getStore().showCombatTexts(combatTexts);
      if (shouldShakePlayerFromCombatTexts(playerTexts)) getStore().shakePlayer();
      enemyTimeoutRef.current = setTimeout(() => {
        enemyTimeoutRef.current = null;
        if (!isCurrentBattleSession(session)) return;
        void handleDrawSequence(
          currentState.hand,
          resultState,
          () => {
            getStore().setBattleState(resultState);
          },
          session,
        ).finally(() => {
          if (!isCurrentBattleSession(session)) return;
          if (playerTurnSkipped) {
            resolveEndTurn(resultState, session);
            return;
          }
          scheduleCompanionFollowUp(resultState, session);
        });
      }, ENEMY_ATTACK_RECOVERY_DELAY);
    }, ENEMY_PHASE_DELAY);
  }

  function scheduleCompanionFollowUp(resultState: BattleState, session: number) {
    if (!resultState.activeCompanion || resultState.enemyHealth <= 0) return;
    companionTimeoutRef.current = setTimeout(() => {
      companionTimeoutRef.current = null;
      companionScheduledRef.current = false;
      if (!isCurrentBattleSession(session)) return;
      const texts = resolveCompanionFollowUpTexts(session);
      if (texts.length > 0) getStore().showCombatTexts(texts);
    }, COMPANION_ATTACK_DELAY);
    companionScheduledRef.current = true;
  }

  function resolveCompanionFollowUpTexts(session: number) {
    if (!isCurrentBattleSession(session)) return [];
    const store = getStore();
    const texts: CombatTextEvent[] = [];
    if (store.battleState.activeCompanion) {
      playCardSound(`companion-${store.battleState.activeCompanion.id}`);
    }
    const newState = processCompanionTurnStart(store.battleState, texts);
    if (!isCurrentBattleSession(session)) return [];
    store.setBattleState(newState);
    store.shakeCompanion();
    return texts;
  }

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
  }

  function skipCombatDevMode() {
    if (screen === "battle") {
      invalidateBattleSession();
      clearPendingBattleTimeouts();
      clearTransferHandles();
      stopBattleFeedback();
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
