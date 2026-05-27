// React battle orchestrator for combat state, card play, turn timing, ghosts, and feedback.
/* eslint-disable react-hooks/refs -- session factories receive ref objects used only in async handlers */
// Depends on pure battle logic, run/talent state, homestead modifiers, audio, and UI hooks.
// Depended on by: useAlchemyRunController for managing active combat.
// Uses useBattleStore (Zustand) instead of local useState for battle data.
import { useEffect, useRef, useState } from "react";
import type { BattleState } from "@/lib/battle";
import { logError } from "@/lib/error-logger";
import type { CardRect, CardTransfer, Screen } from "./types";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import { COMPANION_ATTACK_DELAY } from "@/lib/game-constants";
import { TimerGroup } from "@/lib/animation/game-timer";
import type { RunStateController, TalentStateController } from "./stores/run-store";
import { applyCombatTextPortraitFeedback } from "./battle/battle-feedback";
import { useBattleAutoEndTurn } from "./battle/use-battle-auto-end-turn";
import { useBattleStore } from "./stores/battle-store";
import { createTransferCancelRegistry } from "./battle/transfer-lifecycle";
import { defaultMeasureElementRect, defaultMeasureVisualCardRect } from "./battle/controller-utils";
import { resolveCompanionFollowUpTexts, type TurnOrchestrationDeps } from "./battle/turn-orchestration";
import { createBattleSession } from "./battle/battle-session";
import { createBattleTransferDeps } from "./battle/battle-transfer-deps";
import { createBattleInit } from "./battle/battle-init";
import { createBattleCardPlay } from "./battle/battle-card-play";
import { createBattleEndTurnUi } from "./battle/battle-end-turn-ui";
import { createBattleDevOutcomes } from "./battle/battle-dev-outcomes";

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
  const battleState = useBattleStore((s) => s.battleState);
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
  }, [hasActiveBattle]);

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
    hiddenHandCardKeys,
    playerPanelRef,
    enemyPanelRef,
    battleSceneRef,
    setHoveredCardId,
    talents,
    setDiscoveredCardIds,
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
