// React battle orchestrator for combat state, card play, turn timing, ghosts, and feedback.
/* eslint-disable react-hooks/refs -- session factories receive ref objects used only in async handlers */
// Depends on pure battle logic, run/talent state, homestead modifiers, audio, and UI hooks.
// Depended on by: useAlchemyRunController for managing active combat.
// Uses useBattleStore (Zustand) instead of local useState for battle data.
import type { MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  chooseWishCard,
  getEffectiveCost,
  playBattleCardResolved,
  type BattleState,
  type CombatTextEvent,
  isPlayerDefeated,
} from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import { playCardSound, playGoldGain } from "@/lib/audio";
import { appendUnique } from "@/lib/utils";
import { logError } from "@/lib/error-logger";
import { animateCardActivation } from "./battle/card-ghost-animation";
import type { CardRect, CardTransfer, Screen } from "./types";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import { CARD_ACTIVATION_ROTATION_DEGREES, COMPANION_ATTACK_DELAY, isAnimationDisabled } from "@/lib/game-constants";
import { TimerGroup } from "@/lib/animation/game-timer";
import { getCardRect, getHoverId } from "./utils";
import type { RunStateController } from "./use-run-state";
import type { TalentStateController } from "./use-talent-state";
import {
  applyCombatTextPortraitFeedback,
  portraitFeedbackFromStore,
  shouldPlayCardGoldGain,
} from "./battle/battle-feedback";
import { useBattleAutoEndTurn } from "./battle/use-battle-auto-end-turn";
import { useBattleStore } from "./stores/battle-store";
import { createTransferCancelRegistry } from "./battle/transfer-lifecycle";
import { defaultMeasureElementRect, defaultMeasureVisualCardRect, getCardKey } from "./battle/controller-utils";
import { runHandDrawSequence } from "./battle/draw-sequence";
import {
  resolveCompanionFollowUpTexts,
  resolveEndTurnOrchestration,
  type TurnOrchestrationDeps,
} from "./battle/turn-orchestration";
import { createBattleSession } from "./battle/battle-session";
import { createBattleTransferDeps } from "./battle/battle-transfer-deps";
import { createBattleInit } from "./battle/battle-init";

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
  const logicalBattleState = useBattleStore((s) => s.logicalBattleState);
  const hasActiveBattle = useBattleStore((s) => s.hasActiveBattle);

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
  const resolvedAsHasteOrStunRef = useRef(false);

  function logBattleError(context: string, err: unknown) {
    logError(`Failed to ${context}`, "battle", { error: String(err) }, err instanceof Error ? err.stack : undefined);
  }

  const battleSession = createBattleSession({
    battleSessionRef,
    battleTimerGroupRef,
    transferCancelRegistryRef,
    cardPlayInProgressRef,
    victoryDefeatHandledRef,
    resolvedAsHasteOrStunRef,
    companionScheduledRef,
    onBattleVictory,
    onBattleDefeat,
  });

  const {
    isCurrentBattleSession,
    runIfSessionActive,
    handleVictoryDefeat,
    checkBattleEnd,
    registerTransferCancelCallback,
    clearTransferHandles,
    clearAllBattleTimeouts,
    clearBattleTimeoutsKeepCompanion,
    resetBattleSession,
    getTurnResolutionStore,
  } = battleSession;

  function getStore() {
    return useBattleStore.getState();
  }

  function resetHandTransferUi() {
    setHiddenHandCardKeys(new Set());
    setCardTransferInProgress(false);
  }

  function finishDrawSequence(session: number, state: BattleState) {
    battleSession.finishDrawSequence(session, state, () => {
      resetHandTransferUi();
      checkBattleEnd(state, session);
    });
  }

  const transferDeps = createBattleTransferDeps({
    battleSessionRef,
    battleSceneRef,
    handCardRefs,
    drawPileRef,
    discardPileRef,
    cardPlayInProgressRef,
    transferIdCounterRef,
    measureElementRect,
    measureVisualCardRect,
    isCurrentBattleSession,
    registerTransferCancelCallback,
    battleTimerGroupRef,
    setCardTransfers,
    setHiddenHandCardKeys,
    setCardTransferInProgress,
  });

  const { getDrawSequenceDeps } = transferDeps;

  const { startBattle, startBossBattle, startBossById } = createBattleInit({
    run,
    talents,
    discoveredCardIds,
    homesteadEffectsRef,
    setEncounteredEnemyIds,
    resetBattleSession,
    setCardTransfers,
    setHiddenHandCardKeys,
    setCardTransferInProgress,
  });

  // ─── Effects ───
  useEffect(
    () => () => {
      clearAllBattleTimeouts();
      clearTransferHandles();
      resolvedAsHasteOrStunRef.current = false;
      cardPlayInProgressRef.current = false;
      companionScheduledRef.current = false;
      victoryDefeatHandledRef.current = false;
    },
    [],
  );

  useEffect(() => {
    if (hasActiveBattle) return;
    resetBattleSession();
    queueMicrotask(() => {
      setCardTransfers([]);
      resetHandTransferUi();
    });
  }, [hasActiveBattle]);

  const { scheduleAutoEndTurn } = useBattleAutoEndTurn({
    autoEndTurn,
    screen,
    battleState: logicalBattleState,
    onEndTurn: handleEndTurn,
  });

  function getTurnOrchestrationDeps(): TurnOrchestrationDeps {
    return {
      getStore,
      isCurrentBattleSession,
      runIfSessionActive,
      checkBattleEnd,
      handleVictoryDefeat,
      getTurnResolutionStore,
      getDrawSequenceDeps,
      logBattleError,
      companionScheduledRef,
      battleTimerGroupRef,
      resolvedAsHasteOrStunRef,
      cardPlayInProgressRef,
      resetHandTransferUi,
      scheduleCompanionFollowUp,
      onResolveEndTurn: resolveEndTurn,
    };
  }

  // ─── Card play & draw sequence ───
  function handleDrawSequence(
    oldHand: BattleCard[],
    newState: BattleState,
    applyState: () => void,
    session = battleSessionRef.current,
  ): Promise<boolean> {
    return runHandDrawSequence(oldHand, newState, applyState, session, getDrawSequenceDeps());
  }

  function runDrawSequenceAndFinalize(
    oldHand: BattleCard[],
    newState: BattleState,
    onCommitState: () => void,
    session: number,
    errorContext: string,
  ) {
    void handleDrawSequence(oldHand, newState, onCommitState, session)
      .catch((err) => logBattleError(`handle ${errorContext} draw sequence`, err))
      .finally(() => finishDrawSequence(session, newState));
  }

  function handlePlayCard(
    card: BattleCard,
    index: number,
    sourceRect: { x: number; y: number; width: number; height: number },
  ) {
    const currentState = getStore().logicalBattleState;
    if (!canPlayCard(card, index, currentState)) return;
    const session = battleSessionRef.current;
    cardPlayInProgressRef.current = true;
    animatePlayedCard(card, index, sourceRect);
    playCardSound(card.id);
    const resolution = playBattleCardResolved(currentState, card.id, index);
    playCardResolutionFeedback(card, resolution.state, resolution.combatTexts);
    setHoveredCardId((current) => (current === getHoverId("hand", `${card.id}-${card.uid}`) ? null : current));
    talents.awardCardXP(card);

    runDrawSequenceAndFinalize(
      currentState.hand,
      resolution.state,
      () => {
        getStore().setSyncedBattleState(resolution.state);
        if (resolution.combatTexts.length > 0) getStore().showCombatTexts(resolution.combatTexts);
      },
      session,
      "play card",
    );
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
    const store = getStore();
    applyCombatTextPortraitFeedback(combatTexts, portraitFeedbackFromStore(store));
  }

  function handleCardClick(card: BattleCard, index: number, event: MouseEvent<HTMLButtonElement>) {
    handlePlayCard(card, index, getCardRect(event.currentTarget.getBoundingClientRect()));
  }

  function handleWishChoice(cardOrNull: BattleCard | null) {
    const currentState = getStore().logicalBattleState;
    const newState = chooseWishCard(currentState, cardOrNull?.id ?? null);
    const session = battleSessionRef.current;
    if (cardOrNull) {
      setDiscoveredCardIds((current) => appendUnique(current, cardOrNull.id));
    }
    runDrawSequenceAndFinalize(
      currentState.hand,
      newState,
      () => {
        getStore().setSyncedBattleState(newState);
      },
      session,
      "wish choice",
    );
  }

  // ─── End turn & enemy phase ───
  function handleEndTurn() {
    const currentState = getStore().logicalBattleState;
    if (
      screen !== "battle" ||
      currentState.turnPhase !== "player" ||
      currentState.wishOptions ||
      cardPlayInProgressRef.current ||
      cardTransferInProgress
    )
      return;
    clearBattleTimeoutsKeepCompanion();
    const session = battleSessionRef.current;

    animateEndTurnThenResolve(currentState, session).catch((err) =>
      logBattleError("resolve end turn animation sequence", err),
    );
  }

  async function animateEndTurnThenResolve(currentState: BattleState, session: number) {
    try {
      if (!isAnimationDisabled()) {
        try {
          await transferDeps.animateDiscardedHand(currentState.hand, session);
        } catch (err) {
          logBattleError("discard hand animation", err);
        }
      }
      runIfSessionActive(session, () => {
        resolveEndTurn(currentState, session);
      });
    } finally {
      runIfSessionActive(session, () => {
        if (!resolvedAsHasteOrStunRef.current) {
          resetHandTransferUi();
        }
        cardPlayInProgressRef.current = false;
      });
    }
  }

  function resolveEndTurn(currentState: BattleState, session: number) {
    resolveEndTurnOrchestration(getTurnOrchestrationDeps(), currentState, session);
  }

  function scheduleCompanionFollowUp(resultState: BattleState, session: number) {
    if (!resultState.activeCompanion || resultState.enemyHealth <= 0) return;
    battleTimerGroupRef.current.setTimeout(() => {
      runIfSessionActive(session, () => {
        companionScheduledRef.current = false;
        const texts = resolveCompanionFollowUpTexts(getTurnOrchestrationDeps(), session);
        if (texts.length > 0) {
          const store = getStore();
          store.showCombatTexts(texts);
          applyCombatTextPortraitFeedback(texts, portraitFeedbackFromStore(store));
        }
      });
    }, COMPANION_ATTACK_DELAY);
    companionScheduledRef.current = true;
  }

  // ─── Run end / dev mode ───
  function handleEndRun() {
    if (screen !== "battle") return;
    resetBattleSession();
    const defeatStateSetter = (c: BattleState) => ({
      ...c,
      playerHealth: 0,
      deathsDoorUsed: true,
      deathsDoorActive: false,
      deathsDoorGraceTurnsRemaining: null,
    });
    getStore().setSyncedBattleState(defeatStateSetter);
    handleVictoryDefeat("defeat");
  }

  function skipCombatDevMode() {
    if (screen === "battle") {
      resetBattleSession();
      const skipStateSetter = (c: BattleState) => ({ ...c, enemyHealth: 0, wishOptions: null, wishQueue: [] });
      getStore().setSyncedBattleState(skipStateSetter);
      handleVictoryDefeat("victory");
    }
  }

  return {
    battleState,
    hasActiveBattle,
    handCardRefs,
    drawPileRef,
    discardPileRef,
    battleSceneRef,
    playerPanelRef,
    enemyPanelRef,
    cardTransfers,
    hiddenHandCardKeys,
    cardTransferInProgress,
    startBattle,
    startBossBattle,
    startBossById,
    handleCardClick,
    handleWishChoice,
    handleEndTurn,
    handleEndRun,
    skipCombatDevMode,
    removeCardGhost: getStore().removeCardGhost,
  };
}
