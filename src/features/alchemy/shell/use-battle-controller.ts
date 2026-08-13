import { useCallback, useEffect, useMemo, useLayoutEffect, useRef, useState } from "react";
import {
  useBattleAutoEndTurn,
  useBattleAutoplay,
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
import { preferredAutoplayEnabled, useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { useRunSessionBattleContext } from "@/features/alchemy/shared/stores/run-session-model";
import type { BattleState } from "@/lib/battle";

interface UseBattleControllerProps {
  run: BattleRunPort;
  talents: BattleTalentPort;
  autoEndTurn: boolean;
  homesteadEffects: HomesteadEffectManifest;
  screen: Screen;
  gameMenuOpen: boolean;
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
  gameMenuOpen,
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
  const onBattleSessionPreparedRef = useRef<(() => void) | null>(null);
  const pendingTransitionResumeAttemptedRef = useRef(false);
  const [isAutoplayEnabled, setIsAutoplayEnabled] = useState(() =>
    preferredAutoplayEnabled(useSettingsStore.getState()),
  );

  const applyPreferredAutoplay = useCallback(() => {
    setIsAutoplayEnabled(preferredAutoplayEnabled(useSettingsStore.getState()));
  }, []);

  useLayoutEffect(() => {
    onBattleSessionPreparedRef.current = applyPreferredAutoplay;
  }, [applyPreferredAutoplay]);

  const setAutoplayEnabled = useCallback((enabled: boolean) => {
    setIsAutoplayEnabled(enabled);
    const settings = useSettingsStore.getState();
    if (settings.rememberAutoplayPreference) {
      settings.setAutoplayEnabled(enabled);
    }
  }, []);

  const toggleAutoplay = useCallback(() => {
    setAutoplayEnabled(!isAutoplayEnabled);
  }, [isAutoplayEnabled, setAutoplayEnabled]);

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
    onBattleSessionPreparedRef,
  });

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

  const { scheduleAutoEndTurn, clearAutoEndTurn } = useBattleAutoEndTurn({
    autoEndTurn: autoEndTurn || isAutoplayEnabled,
    screen,
    battleState,
    hasActiveBattle,
    cardTransferInProgress,
    hiddenHandCardKeys,
    onEndTurn: actions.endTurnUi.handleEndTurn,
  });

  useBattleAutoplay({
    enabled: isAutoplayEnabled,
    screen,
    battleState,
    hasActiveBattle,
    cardTransferInProgress,
    hiddenHandCardKeys,
    isCardPlayInProgress: () => ctx.cardPlayInProgressRef.current,
    gameMenuOpen,
    playCard: actions.cardPlay.handleAutoplayCard,
  });

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
    isAutoplayEnabled,
    toggleAutoplay,
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
