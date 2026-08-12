import { useEffect, useMemo, useLayoutEffect, useRef } from "react";
import {
  useBattleAutoEndTurn,
  createBattleSession,
  defaultMeasureElementRect,
  defaultMeasureVisualCardRect,
  createBattleEndTurnUi,
  createBattleTransferDeps,
  createBattleInit,
  createBattleCardPlay,
  createBattleDevOutcomes,
  isVictoryGraceActive,
  useBattleControllerContext,
} from "@/features/alchemy/run-loop/battle";
import type { CardRect, Screen } from "@/features/alchemy/shared/types";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import type { BattleRunPort, BattleTalentPort } from "@/features/alchemy/shared/stores/run-port-types";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { useRunSessionBattleContext } from "@/features/alchemy/shared/stores/run-session-model";
import type { BattleState } from "@/lib/battle";

interface UseBattleControllerProps {
  run: BattleRunPort;
  talents: BattleTalentPort;
  autoEndTurn: boolean;
  homesteadEffects: HomesteadEffectManifest;
  screen: Screen;
  setHoveredCardId: React.Dispatch<React.SetStateAction<string | null>>;
  onBattleVictory?: () => void;
  onBattleDefeat?: () => void;
  measureElementRect?: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
  measureVisualCardRect?: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
}

export function useBattleController({
  run,
  talents,
  autoEndTurn,
  homesteadEffects,
  screen,
  setHoveredCardId,
  onBattleVictory,
  onBattleDefeat,
  measureElementRect = defaultMeasureElementRect,
  measureVisualCardRect = defaultMeasureVisualCardRect,
}: UseBattleControllerProps) {
  const {
    battle: { battleState, hasActiveBattle, pendingBattleTransition, pendingTransitionResumeRequired },
  } = useRunSessionBattleContext(screen);
  const removeCardGhost = useBattlePresentationStore((s) => s.removeCardGhost);
  const resetPresentation = useBattlePresentationStore((s) => s.resetPresentation);

  const scheduleAutoEndTurnRef = useRef<((state: BattleState) => void) | null>(null);
  const clearAutoEndTurnRef = useRef<(() => void) | null>(null);
  const pendingTransitionResumeAttemptedRef = useRef(false);

  // Initialize/Update the unified context
  const ctx = useBattleControllerContext({
    run,
    talents,
    autoEndTurn,
    homesteadEffects,
    screen,
    setHoveredCardId,
    onBattleVictory,
    onBattleDefeat,
    measureElementRect,
    measureVisualCardRect,
    scheduleAutoEndTurnRef,
    clearAutoEndTurnRef,
  });

  // Instantiate action handlers exactly once on mount
  const actions = useMemo(() => {
    const session = createBattleSession(ctx);
    const transferDeps = createBattleTransferDeps(ctx, session.isCurrentBattleSession);
    const endTurnUi = createBattleEndTurnUi(ctx, session, transferDeps);
    const cardPlay = createBattleCardPlay(ctx, session, transferDeps);
    const init = createBattleInit(ctx, session);
    const devOutcomes = createBattleDevOutcomes(ctx, session);

    return {
      session,
      endTurnUi,
      cardPlay,
      init,
      devOutcomes,
    };
  }, [ctx]);

  const hiddenHandCardKeys = useBattlePresentationStore((s) => s.hiddenHandCardKeys);
  const cardTransferInProgress = useBattlePresentationStore((s) => s.cardTransferInProgress);

  // Auto end turn hook
  const { scheduleAutoEndTurn, clearAutoEndTurn } = useBattleAutoEndTurn({
    autoEndTurn,
    screen,
    battleState,
    hasActiveBattle,
    cardTransferInProgress,
    hiddenHandCardKeys,
    onEndTurn: actions.endTurnUi.handleEndTurn,
  });

  // Wire schedule/clear auto-end back into context for card play and end-turn
  useLayoutEffect(() => {
    scheduleAutoEndTurnRef.current = scheduleAutoEndTurn;
    clearAutoEndTurnRef.current = clearAutoEndTurn;
  }, [scheduleAutoEndTurn, clearAutoEndTurn]);

  useEffect(() => {
    if (!hasActiveBattle) {
      pendingTransitionResumeAttemptedRef.current = false;
      return;
    }
    if (
      screen !== "battle" ||
      !pendingBattleTransition ||
      !pendingTransitionResumeRequired ||
      pendingTransitionResumeAttemptedRef.current
    ) {
      return;
    }
    pendingTransitionResumeAttemptedRef.current = true;
    actions.endTurnUi.resumePendingBattleTransition();
  }, [actions.endTurnUi, hasActiveBattle, pendingBattleTransition, pendingTransitionResumeRequired, screen]);

  const resetHandTransferUi = useBattlePresentationStore((s) => s.resetHandTransferUi);

  useEffect(() => {
    if (hasActiveBattle) return;
    if (isVictoryGraceActive(screen, battleState.enemyHealth, ctx.victoryDefeatHandledRef.current)) return;
    actions.session.resetBattleSession();
    queueMicrotask(() => {
      useBattlePresentationStore.getState().resetCardTransfers();
      resetHandTransferUi();
    });
  }, [hasActiveBattle, screen, battleState.enemyHealth, actions.session, resetHandTransferUi, ctx]);

  useEffect(() => {
    if (screen !== "battle") {
      resetPresentation();
    }
  }, [screen, resetPresentation]);

  return {
    battleState,
    hasActiveBattle,
    refs: {
      handCardRefs: ctx.handCardRefs,
      drawPileRef: ctx.drawPileRef,
      discardPileRef: ctx.discardPileRef,
      battleSceneRef: ctx.battleSceneRef,
      playerPanelRef: ctx.playerPanelRef,
      enemyPanelRef: ctx.enemyPanelRef,
    },
    startBattle: actions.init.startBattle,
    startBossBattle: actions.init.startBossBattle,
    startBossById: actions.init.startBossById,
    handleCardClick: actions.cardPlay.handleCardClick,
    handleWishChoice: actions.cardPlay.handleWishChoice,
    handleEndTurn: actions.endTurnUi.handleEndTurn,
    handleEndRun: actions.devOutcomes.handleEndRun,
    skipCombatDevMode: actions.devOutcomes.skipCombatDevMode,
    removeCardGhost,
  };
}
