// React battle orchestrator for combat state, card play, turn timing, ghosts, and feedback.
/* eslint-disable react-hooks/refs -- session factories receive ref objects used only in async handlers */
// Depends on pure battle logic, run/talent state, homestead modifiers, audio, and UI hooks.
// Depended on by: useAlchemyRunController for managing active combat.
// Uses run domain battle slice instead of local useState for battle data.
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import type { BattleState } from "@/lib/battle";
import { getPlayableHandCardKeys } from "@/features/alchemy/run-loop/battle/playable-hand";
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
    return getBattleSessionStore();
  }

  const playableHandCardKeys = useMemo(() => {
    if (cardTransferInProgress) return new Set<string>();
    return getPlayableHandCardKeys(battleState);
  }, [battleState, cardTransferInProgress]);

  const resetHandTransferUi = useCallback(() => {
    setHiddenHandCardKeys(new Set());
    setCardTransferInProgress(false);
  }, [setHiddenHandCardKeys, setCardTransferInProgress]);

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
    hasActiveBattle: () => useRunDomainStore.getState().battle.hasActiveBattle,
    revealCardKey: (cardKey) => useBattlePresentationStore.getState().addRevealedCardKey(cardKey),
  });

  const { getDrawSequenceDeps } = transferDeps;

  const { startBattle, startBossBattle, startBossById } = createBattleInit({
    run,
    talents,
    homesteadEffectsRef,
    resetBattleSession,
    setCardTransfers,
    setHiddenHandCardKeys,
    setCardTransferInProgress,
  });

  // createBattleSession() returns new function identities each render; refs keep effects stable.
  const clearAllBattleTimeoutsRef = useRef(clearAllBattleTimeouts);
  clearAllBattleTimeoutsRef.current = clearAllBattleTimeouts;
  const clearTransferHandlesRef = useRef(clearTransferHandles);
  clearTransferHandlesRef.current = clearTransferHandles;
  const resetBattleSessionRef = useRef(resetBattleSession);
  resetBattleSessionRef.current = resetBattleSession;

  // Mount-only teardown — do not re-run when session helper identities change.
  useEffect(
    () => () => {
      clearAllBattleTimeoutsRef.current();
      clearTransferHandlesRef.current();
      resolvedAsHasteOrStunRef.current = false;
      cardPlayInProgressRef.current = false;
      companionScheduledRef.current = false;
      victoryDefeatHandledRef.current = false;
    },
    [],
  );

  // Reset transfer UI when battle ends; only react to hasActiveBattle, not resetBattleSession identity.
  useEffect(() => {
    if (hasActiveBattle) return;
    resetBattleSessionRef.current();
    queueMicrotask(() => {
      setCardTransfers([]);
      resetHandTransferUi();
    });
  }, [hasActiveBattle, setCardTransfers, resetHandTransferUi]);

  function scheduleCompanionFollowUp(resultState: BattleState, session: number) {
    if (!resultState.activeCompanion || resultState.enemyHealth <= 0) return;
    battleTimerGroupRef.current.setTimeout(() => {
      runIfSessionActive(session, () => {
        companionScheduledRef.current = false;
        const texts = resolveCompanionFollowUpTexts(getTurnOrchestrationDeps(), session);
        if (texts.length > 0) {
          const store = getStore();
          store.showCombatTexts(texts);
          applyCombatTextPortraitFeedback(texts, store);
        }
      });
    }, COMPANION_ATTACK_DELAY);
    companionScheduledRef.current = true;
  }

  let resolveEndTurn = (_currentState: BattleState, _session: number) => {};

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

  const { handleEndTurn, resolveEndTurn: assignResolveEndTurn } = createBattleEndTurnUi({
    screen,
    battleSessionRef,
    cardPlayInProgressRef,
    cardTransferInProgress,
    resolvedAsHasteOrStunRef,
    clearBattleTimeoutsKeepCompanion,
    runIfSessionActive,
    resetHandTransferUi,
    getTurnOrchestrationDeps,
    animateDiscardedHand: transferDeps.animateDiscardedHand,
    logBattleError,
    getStore,
  });
  resolveEndTurn = assignResolveEndTurn;

  const { scheduleAutoEndTurn } = useBattleAutoEndTurn({
    autoEndTurn,
    screen,
    battleState,
    onEndTurn: handleEndTurn,
  });

  const { handleCardClick, handleWishChoice } = createBattleCardPlay({
    screen,
    battleState,
    battleSessionRef,
    cardPlayInProgressRef,
    cardTransferInProgress,
    hiddenHandCardKeys,
    playerPanelRef,
    enemyPanelRef,
    battleSceneRef,
    setHoveredCardId,
    talents,
    getDrawSequenceDeps,
    finishDrawSequence,
    runIfSessionActive,
    scheduleAutoEndTurn,
    logBattleError,
  });

  const { handleEndRun, skipCombatDevMode } = createBattleDevOutcomes({
    screen,
    resetBattleSession,
    handleVictoryDefeat,
  });

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
