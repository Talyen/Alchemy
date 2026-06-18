// React battle orchestrator for combat state, card play, turn timing, ghosts, and feedback.
/* eslint-disable react-hooks/refs -- session factories receive ref objects used only in async handlers */
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
import { getBattleSessionStore } from "@/features/alchemy/run-loop/battle/battle-session";
import { createTransferCancelRegistry } from "@/features/alchemy/run-loop/battle/card-transfer-animations";
import {
  defaultMeasureElementRect,
  defaultMeasureVisualCardRect,
} from "@/features/alchemy/run-loop/battle/controller-utils";
import {
  resolveCompanionFollowUpTexts,
  type TurnOrchestrationDeps,
} from "@/features/alchemy/run-loop/battle/turn-orchestration";
import { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
import { createBattleTransferDeps } from "@/features/alchemy/run-loop/battle/battle-transfer-deps";
import { createBattleInit } from "@/features/alchemy/run-loop/battle/battle-init";
import { createBattleCardPlay } from "@/features/alchemy/run-loop/battle/battle-card-play";
import { createBattleEndTurnUi } from "@/features/alchemy/run-loop/battle/turn-orchestration";
import { createBattleDevOutcomes } from "@/features/alchemy/run-loop/battle/battle-dev-outcomes";
import { isVictoryGraceActive } from "@/features/alchemy/run-loop/battle/battle-victory-grace";
import type { BattleControllerContext } from "@/features/alchemy/run-loop/battle/controller-context";

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
  homesteadEffectsRef: React.MutableRefObject<HomesteadEffectManifest>;
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
  const cardTransfers = useBattlePresentationStore((s) => s.cardTransfers);
  const setCardTransfers = useBattlePresentationStore((s) => s.setCardTransfers);
  const hiddenHandCardKeys = useBattlePresentationStore((s) => s.hiddenHandCardKeys);
  const setHiddenHandCardKeys = useBattlePresentationStore((s) => s.setHiddenHandCardKeys);
  const cardTransferInProgress = useBattlePresentationStore((s) => s.cardTransferInProgress);
  const setCardTransferInProgress = useBattlePresentationStore((s) => s.setCardTransferInProgress);
  const transferIdCounterRef = useRef(0);
  const resolvedAsHasteOrStunRef = useRef(false);

  function logBattleError(context: string, err: unknown) {
    logError(`Failed to ${context}`, "battle", { error: String(err) }, err instanceof Error ? err.stack : undefined);
  }

  const onVictoryRef = useRef(onBattleVictory);
  const onDefeatRef = useRef(onBattleDefeat);
  useEffect(() => {
    onVictoryRef.current = onBattleVictory;
    onDefeatRef.current = onBattleDefeat;
  }, [onBattleVictory, onBattleDefeat]);

  function getStore() {
    return getBattleSessionStore();
  }

  // Define stable getter for context to avoid circular reference issues
  const contextRef = useRef<BattleControllerContext>(null as unknown as BattleControllerContext);
  const getContext = useCallback(() => contextRef.current, []);

  // Base session identity & guards
  const battleSession = useMemo(() => createBattleSession(getContext), [getContext]);

  const {
    isCurrentBattleSession,
    runIfSessionActive,
    handleVictoryDefeat,
    checkBattleEnd,
    clearTransferHandles,
    clearAllBattleTimeouts,
    clearBattleTimeoutsKeepCompanion,
    resetBattleSession,
    getTurnResolutionStore,
  } = battleSession;

  const playableHandCardKeys = useMemo(
    () => getPlayableHandCardKeysExcludingHidden(battleState, hiddenHandCardKeys),
    [battleState, hiddenHandCardKeys],
  );

  const resetHandTransferUi = useCallback(() => {
    setHiddenHandCardKeys(new Set());
    setCardTransferInProgress(false);
  }, [setHiddenHandCardKeys, setCardTransferInProgress]);

  const finishDrawSequence = useCallback(
    (session: number, state: BattleState) => {
      battleSession.finishDrawSequence(session, state, () => {
        resetHandTransferUi();
        checkBattleEnd(state, session);
      });
    },
    [battleSession, resetHandTransferUi, checkBattleEnd],
  );

  // Re-evaluable EndTurn callback refs to prevent stale captures
  const resolveEndTurnRef = useRef<(_currentState: BattleState, _session: number) => void>(() => {});
  const getTurnOrchestrationDepsRef = useRef<() => TurnOrchestrationDeps>(
    null as unknown as () => TurnOrchestrationDeps,
  );
  const scheduleCompanionFollowUpRef = useRef<(resultState: BattleState, session: number) => void>(
    null as unknown as (resultState: BattleState, session: number) => void,
  );

  const scheduleCompanionFollowUp = useCallback(
    (resultState: BattleState, session: number) => {
      if (!resultState.activeCompanion || resultState.enemyHealth <= 0) return;
      battleTimerGroupRef.current.setTimeout(() => {
        runIfSessionActive(session, () => {
          companionScheduledRef.current = false;
          const texts = resolveCompanionFollowUpTexts(getTurnOrchestrationDepsRef.current(), session);
          if (texts.length > 0) {
            const store = getStore();
            store.showCombatTexts(texts);
            applyCombatTextPortraitFeedback(texts, store);
          }
        });
      }, COMPANION_ATTACK_DELAY);
      companionScheduledRef.current = true;
    },
    [runIfSessionActive],
  );
  scheduleCompanionFollowUpRef.current = scheduleCompanionFollowUp;

  const getTurnOrchestrationDeps = useCallback(() => {
    return {
      getStore,
      isCurrentBattleSession,
      runIfSessionActive,
      checkBattleEnd,
      handleVictoryDefeat,
      getTurnResolutionStore,
      getDrawSequenceDeps: () => getContext().getDrawSequenceDeps(),
      logBattleError,
      companionScheduledRef,
      battleTimerGroupRef,
      resolvedAsHasteOrStunRef,
      cardPlayInProgressRef,
      resetHandTransferUi,
      scheduleCompanionFollowUp: scheduleCompanionFollowUpRef.current,
      onResolveEndTurn: (currentState: BattleState, session: number) =>
        resolveEndTurnRef.current(currentState, session),
    };
  }, [
    isCurrentBattleSession,
    runIfSessionActive,
    checkBattleEnd,
    handleVictoryDefeat,
    getTurnResolutionStore,
    resetHandTransferUi,
    getContext,
  ]);
  getTurnOrchestrationDepsRef.current = getTurnOrchestrationDeps;

  const transferDeps = useMemo(() => createBattleTransferDeps(getContext), [getContext]);

  const battleInit = useMemo(() => createBattleInit(getContext), [getContext]);
  const { startBattle, startBossBattle, startBossById } = battleInit;

  // Mount-only teardown — do not re-run when session helper identities change.
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
      setCardTransfers([]);
      resetHandTransferUi();
    });
  }, [hasActiveBattle, screen, battleState.enemyHealth, resetBattleSession, setCardTransfers, resetHandTransferUi]);

  useEffect(() => {
    if (screen !== "battle") {
      clearFloatingCombatTexts();
    }
  }, [screen, clearFloatingCombatTexts]);

  const endTurnUi = useMemo(() => createBattleEndTurnUi(getContext), [getContext]);
  const { handleEndTurn, resolveEndTurn: assignResolveEndTurn } = endTurnUi;
  resolveEndTurnRef.current = assignResolveEndTurn;

  const { scheduleAutoEndTurn } = useBattleAutoEndTurn({
    autoEndTurn,
    screen,
    battleState,
    onEndTurn: handleEndTurn,
  });

  const cardPlay = useMemo(() => createBattleCardPlay(getContext), [getContext]);
  const { handleCardClick, handleWishChoice } = cardPlay;

  const devOutcomes = useMemo(() => createBattleDevOutcomes(getContext), [getContext]);
  const { handleEndRun, skipCombatDevMode } = devOutcomes;

  // Populate contextRef.current on every render. Since consumers access it
  // lazily via getContext(), they always receive the latest values from this render.
  contextRef.current = {
    screen,
    run,
    talents,
    autoEndTurn,
    homesteadEffectsRef,
    onBattleVictory,
    onBattleDefeat,
    measureElementRect,
    measureVisualCardRect,
    setHoveredCardId,

    handCardRefs,
    drawPileRef,
    discardPileRef,
    battleSceneRef,
    playerPanelRef,
    enemyPanelRef,

    cardPlayInProgressRef,
    companionScheduledRef,
    battleTimerGroupRef,
    battleSessionRef,
    victoryDefeatHandledRef,
    transferCancelRegistryRef,
    transferIdCounterRef,
    resolvedAsHasteOrStunRef,

    battleState,
    cardTransfers,
    setCardTransfers,
    hiddenHandCardKeys,
    setHiddenHandCardKeys,
    cardTransferInProgress,
    setCardTransferInProgress,

    isCurrentBattleSession,
    runIfSessionActive,
    checkBattleEnd,
    handleVictoryDefeat,
    clearAllBattleTimeouts,
    clearBattleTimeoutsKeepCompanion,
    resetBattleSession,
    logBattleError,
    resetHandTransferUi,

    getDrawSequenceDeps: () => transferDeps.getDrawSequenceDeps(),
    finishDrawSequence,
    scheduleAutoEndTurn: (state: BattleState) => scheduleAutoEndTurn(state),
    getTurnOrchestrationDeps: () => getTurnOrchestrationDepsRef.current(),
    animateDiscardedHand: (hand: import("@/lib/game-data").BattleCard[], session: number) =>
      transferDeps.animateDiscardedHand(hand, session),
  };

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
