// React battle orchestrator for combat state, card play, turn timing, ghosts, and feedback.
/* eslint-disable react-hooks/refs, react-hooks/preserve-manual-memoization -- factories receive ref objects for async handlers; ref.current assignments are deliberate */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import type { BattleState } from "@/lib/battle";
import { getPlayableHandCardKeysExcludingHidden } from "@/features/alchemy/run-loop/battle/playable-hand";
import { logError } from "@/lib/error-logger";
import type { CardRect, Screen } from "@/features/alchemy/shared/types";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import { COMPANION_ATTACK_DELAY } from "@/lib/game-constants";
import { TimerGroup } from "@/lib/animation/game-timer";
import type { RunStateController, TalentStateController } from "@/features/alchemy/shared/stores/run-session-facade";
import { applyCombatTextPortraitFeedback } from "@/features/alchemy/run-loop/battle/battle-feedback";
import { useBattleAutoEndTurn } from "@/features/alchemy/run-loop/battle/use-battle-auto-end-turn";
import { useRunDomainStore } from "@/features/alchemy/shared/stores/run-session-facade";
import { useBattlePresentationStore } from "@/features/alchemy/shared/stores/battle-presentation-store";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { useRunSessionBattleContext } from "@/features/alchemy/shared/stores/run-session-facade";
import type { BattleScreenData } from "@/features/alchemy/run-loop/screens/battle-screen/types";
import { createTransferCancelRegistry } from "@/features/alchemy/run-loop/battle/card-transfer-animations";
import { getBattleSessionStore } from "@/features/alchemy/run-loop/battle/battle-session";
import { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
import {
  defaultMeasureElementRect,
  defaultMeasureVisualCardRect,
} from "@/features/alchemy/run-loop/battle/controller-utils";
import {
  resolveCompanionFollowUpTexts,
  type TurnOrchestrationDeps,
} from "@/features/alchemy/run-loop/battle/turn-orchestration";
import { createBattleTransferDeps } from "@/features/alchemy/run-loop/battle/battle-transfer-deps";
import { createBattleInit } from "@/features/alchemy/run-loop/battle/battle-init";
import { createBattleCardPlay } from "@/features/alchemy/run-loop/battle/battle-card-play";
import { createBattleEndTurnUi } from "@/features/alchemy/run-loop/battle/turn-orchestration";
import { createBattleDevOutcomes } from "@/features/alchemy/run-loop/battle/battle-dev-outcomes";
import { isVictoryGraceActive } from "@/features/alchemy/run-loop/battle/battle-victory-grace";

export function useBattleController({
  run,
  talents,
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
  autoEndTurn: boolean;
  homesteadEffectsRef: React.RefObject<HomesteadEffectManifest>;
  screen: Screen;
  setHoveredCardId: React.Dispatch<React.SetStateAction<string | null>>;
  onBattleVictory?: () => void;
  onBattleDefeat?: () => void;
  measureElementRect?: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
  measureVisualCardRect?: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
}) {
  const {
    battle: { battleState, hasActiveBattle },
    activeLabyrinthModifiers,
  } = useRunSessionBattleContext(screen);
  const displayOverrides = useRunDomainStore((s) => s.battle.displayOverrides);
  const battlePresentation = useBattlePresentationStore(
    useShallow((s) => ({
      revealedCardKeys: s.revealedCardKeys,
      cardGhosts: s.cardGhosts,
      floatingCombatTexts: s.floatingCombatTexts,
      enemyShaking: s.enemyShaking,
      playerShaking: s.playerShaking,
      companionShaking: s.companionShaking,
      playerHurtFlashToken: s.playerHurtFlashToken,
      enemyHurtFlashToken: s.enemyHurtFlashToken,
    })),
  );
  const { hoveredCardId, shimmerState, maybeTriggerShimmer } = useUiStore(
    useShallow((s) => ({
      hoveredCardId: s.hoveredCardId,
      shimmerState: s.shimmerState,
      maybeTriggerShimmer: s.maybeTriggerShimmer,
    })),
  );
  const removeCardGhost = useBattlePresentationStore((s) => s.removeCardGhost);
  const clearFloatingCombatTexts = useBattlePresentationStore((s) => s.clearFloatingCombatTexts);

  const battleScreenData: BattleScreenData = useMemo(
    () => ({
      battleState,
      displayOverrides,
      ...battlePresentation,
      hoveredCardId,
      shimmerState,
      maybeTriggerShimmer,
      activeLabyrinthModifiers,
    }),
    [
      battleState,
      displayOverrides,
      battlePresentation,
      hoveredCardId,
      shimmerState,
      maybeTriggerShimmer,
      activeLabyrinthModifiers,
    ],
  );

  // Refs
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
  const transferIdCounterRef = useRef(0);
  const resolvedAsHasteOrStunRef = useRef(false);

  const onVictoryRef = useRef(onBattleVictory);
  const onDefeatRef = useRef(onBattleDefeat);
  useEffect(() => {
    onVictoryRef.current = onBattleVictory;
    onDefeatRef.current = onBattleDefeat;
  }, [onBattleVictory, onBattleDefeat]);

  const logBattleError = useCallback((context: string, err: unknown) => {
    logError(`Failed to ${context}`, "battle", { error: String(err) }, err instanceof Error ? err.stack : undefined);
  }, []);

  // Session identity & guards
  const battleSession = useMemo(
    () =>
      createBattleSession({
        battleSessionRef,
        battleTimerGroupRef,
        transferCancelRegistryRef,
        cardPlayInProgressRef,
        victoryDefeatHandledRef,
        resolvedAsHasteOrStunRef,
        companionScheduledRef,
        onBattleVictory: () => onVictoryRef.current?.(),
        onBattleDefeat: () => onDefeatRef.current?.(),
      }),
    [],
  );

  const {
    isCurrentBattleSession,
    runIfSessionActive,
    checkBattleEnd,
    handleVictoryDefeat,
    clearTransferHandles,
    clearAllBattleTimeouts,
    clearBattleTimeoutsKeepCompanion,
    resetBattleSession,
  } = battleSession;

  const resetHandTransferUi = useCallback(() => {
    useBattlePresentationStore.getState().resetHandTransferUi();
  }, []);

  const finishDrawSequence = useCallback(
    (session: number, state: BattleState) => {
      battleSession.finishDrawSequence(session, state, () => {
        resetHandTransferUi();
        checkBattleEnd(state, session);
      });
    },
    [battleSession, resetHandTransferUi, checkBattleEnd],
  );

  // Transfer deps (animation helpers)
  const transferDeps = useMemo(
    () =>
      createBattleTransferDeps({
        measureElementRect,
        measureVisualCardRect,
        battleSceneRef,
        transferIdCounterRef,
        transferCancelRegistryRef,
        handCardRefs,
        battleTimerGroupRef,
        isCurrentBattleSession,
        discardPileRef,
        drawPileRef,
        cardPlayInProgressRef,
      }),
    [measureElementRect, measureVisualCardRect, isCurrentBattleSession],
  );

  // Companion follow-up, turn orchestration, and end-turn UI
  const scheduleCompanionFollowUp = useCallback(
    (resultState: BattleState, session: number) => {
      if (!resultState.activeCompanion || resultState.enemyHealth <= 0) return;
      battleTimerGroupRef.current.setTimeout(() => {
        runIfSessionActive(session, () => {
          companionScheduledRef.current = false;
          const texts = resolveCompanionFollowUpTexts(
            {
              getStore: getBattleSessionStore,
              isCurrentBattleSession,
              runIfSessionActive,
            },
            session,
          );
          if (texts.length > 0) {
            const store = getBattleSessionStore();
            store.showCombatTexts(texts);
            applyCombatTextPortraitFeedback(texts, store);
          }
        });
      }, COMPANION_ATTACK_DELAY);
      companionScheduledRef.current = true;
    },
    [runIfSessionActive, isCurrentBattleSession],
  );

  const deps: TurnOrchestrationDeps = useMemo(
    () => ({
      getStore: getBattleSessionStore,
      isCurrentBattleSession,
      runIfSessionActive,
      checkBattleEnd,
      handleVictoryDefeat,
      getDrawSequenceDeps: () => transferDeps.getDrawSequenceDeps(),
      logBattleError,
      resetHandTransferUi,
      scheduleCompanionFollowUp,
    }),
    [
      isCurrentBattleSession,
      runIfSessionActive,
      checkBattleEnd,
      handleVictoryDefeat,
      transferDeps,
      logBattleError,
      resetHandTransferUi,
      scheduleCompanionFollowUp,
    ],
  );

  const { handleEndTurn } = useMemo(
    () =>
      createBattleEndTurnUi({
        screen,
        battleSessionRef,
        cardPlayInProgressRef,
        runIfSessionActive,
        logBattleError,
        resetHandTransferUi,
        clearBattleTimeoutsKeepCompanion,
        animateDiscardedHand: (hand, session) => transferDeps.animateDiscardedHand(hand, session),
        deps,
      }),
    [
      screen,
      battleSessionRef,
      cardPlayInProgressRef,
      runIfSessionActive,
      logBattleError,
      resetHandTransferUi,
      clearBattleTimeoutsKeepCompanion,
      transferDeps,
      deps,
    ],
  );

  // Auto end turn
  const { scheduleAutoEndTurn } = useBattleAutoEndTurn({
    autoEndTurn,
    screen,
    battleState,
    onEndTurn: handleEndTurn,
  });

  // Card play
  const cardPlay = useMemo(
    () =>
      createBattleCardPlay({
        screen,
        runIfSessionActive,
        cardPlayInProgressRef,
        battleSessionRef,
        finishDrawSequence,
        logBattleError,
        playerPanelRef,
        enemyPanelRef,
        battleSceneRef,
        setHoveredCardId,
        talents,
        getDrawSequenceDeps: () => transferDeps.getDrawSequenceDeps(),
        scheduleAutoEndTurn,
      }),
    [
      screen,
      runIfSessionActive,
      finishDrawSequence,
      logBattleError,
      setHoveredCardId,
      talents,
      transferDeps,
      scheduleAutoEndTurn,
    ],
  );
  const { handleCardClick, handleWishChoice } = cardPlay;

  // Battle init
  const battleInit = useMemo(
    () =>
      createBattleInit({
        resetBattleSession,
        run,
        talents,
        homesteadEffectsRef,
      }),
    [resetBattleSession, run, talents, homesteadEffectsRef],
  );
  const { startBattle, startBossBattle, startBossById } = battleInit;

  // Dev outcomes
  const devOutcomes = useMemo(
    () =>
      createBattleDevOutcomes({
        screen,
        resetBattleSession,
        handleVictoryDefeat,
      }),
    [screen, resetBattleSession, handleVictoryDefeat],
  );
  const { handleEndRun, skipCombatDevMode } = devOutcomes;

  // Playable hand card keys
  const hiddenHandCardKeys = useBattlePresentationStore((s) => s.hiddenHandCardKeys);
  const playableHandCardKeys = useMemo(
    () => getPlayableHandCardKeysExcludingHidden(battleState, hiddenHandCardKeys),
    [battleState, hiddenHandCardKeys],
  );

  const cardTransfers = useBattlePresentationStore((s) => s.cardTransfers);
  const cardTransferInProgress = useBattlePresentationStore((s) => s.cardTransferInProgress);

  // Mount-only teardown
  useEffect(
    () => () => {
      clearAllBattleTimeouts();
      clearTransferHandles();
      resolvedAsHasteOrStunRef.current = false;
      cardPlayInProgressRef.current = false;
      companionScheduledRef.current = false;
      victoryDefeatHandledRef.current = false;
    },
    [clearAllBattleTimeouts, clearTransferHandles],
  );

  useEffect(() => {
    if (hasActiveBattle) return;
    if (isVictoryGraceActive(screen, battleState.enemyHealth, victoryDefeatHandledRef.current)) return;
    resetBattleSession();
    queueMicrotask(() => {
      useBattlePresentationStore.getState().resetCardTransfers();
      resetHandTransferUi();
    });
  }, [hasActiveBattle, screen, battleState.enemyHealth, resetBattleSession, resetHandTransferUi]);

  useEffect(() => {
    if (screen !== "battle") {
      clearFloatingCombatTexts();
    }
  }, [screen, clearFloatingCombatTexts]);

  return {
    battleState,
    battleScreenData,
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
    removeCardGhost,
    playableHandCardKeys,
  };
}
