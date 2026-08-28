import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  createBattleSession,
  defaultMeasureElementRect,
  defaultMeasureVisualCardRect,
  createBattleEndTurnUi,
  createBattleTransferDeps,
  createBattleInit,
  createBattleCardPlay,
  createBattleDevOutcomes,
  createBattleOpeningDraw,
  isVictoryGraceActive,
  useBattleControllerContext,
} from "@/features/alchemy/run-loop/battle";
import type { CardRect } from "@/features/alchemy/shared/types";
import type { Screen } from "@/lib/routing";
import { clearBattlePresentationUi } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { useBattleLifetimeFields } from "@/features/alchemy/shared/stores/run-session-react-ports";
import { readBattle } from "@/features/alchemy/shared/stores/run-session-read-port";
import type { BattleState } from "@/lib/battle";
import type { BattlePlaybackBind } from "@/features/alchemy/run-loop/battle/battle-context";
import { preferredAutoplayEnabled, useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";

interface UseBattleControllerProps {
  screen: Screen;
  setHoveredCardId: React.Dispatch<React.SetStateAction<string | null>>;
  onBattleVictory?: () => void;
  onBattleDefeat?: () => void;
  measureElementRect?: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
  measureVisualCardRect?: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
}

export function useBattleController({
  screen,
  setHoveredCardId,
  onBattleVictory,
  onBattleDefeat,
  measureElementRect = defaultMeasureElementRect,
  measureVisualCardRect = defaultMeasureVisualCardRect,
}: UseBattleControllerProps) {
  const { hasActiveBattle, pendingBattleTransition, pendingTransitionResumeRequired } = useBattleLifetimeFields();

  const scheduleAutoEndTurnRef = useRef<((state?: BattleState) => void) | null>(null);
  const clearAutoEndTurnRef = useRef<(() => void) | null>(null);
  const onBattleSessionPreparedRef = useRef<(() => void) | null>(null);
  const pendingTransitionResumeAttemptedRef = useRef(false);
  const [isAutoplayEnabled, setIsAutoplayEnabledState] = useState(() =>
    preferredAutoplayEnabled(useSettingsStore.getState()),
  );

  const setAutoplayEnabled = useCallback((enabled: boolean) => {
    setIsAutoplayEnabledState(enabled);
    const settings = useSettingsStore.getState();
    if (settings.rememberAutoplayPreference) {
      settings.setAutoplayEnabled(enabled);
    }
  }, []);

  const applyPreferredAutoplay = useCallback(() => {
    setIsAutoplayEnabledState(preferredAutoplayEnabled(useSettingsStore.getState()));
  }, []);

  useLayoutEffect(() => {
    onBattleSessionPreparedRef.current = applyPreferredAutoplay;
  }, [applyPreferredAutoplay]);

  const ctx = useBattleControllerContext({
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
    const openingDraw = createBattleOpeningDraw(ctx, transferDeps);
    const devOutcomes = createBattleDevOutcomes(ctx, session);

    return {
      session,
      endTurnUi,
      cardPlay,
      init,
      openingDraw,
      devOutcomes,
    };
  }, [ctx]);

  useEffect(() => {
    if (!hasActiveBattle) {
      pendingTransitionResumeAttemptedRef.current = false;
      return;
    }
    if (screen !== "battle" || !pendingTransitionResumeRequired || pendingTransitionResumeAttemptedRef.current) {
      return;
    }
    pendingTransitionResumeAttemptedRef.current = true;
    actions.endTurnUi.resumePendingBattleTransition();
  }, [actions.endTurnUi, hasActiveBattle, pendingTransitionResumeRequired, screen]);

  const playOpeningDrawWhenReady = useCallback(() => {
    const battle = readBattle();
    if (
      battle.pendingTransitionResumeRequired ||
      battle.pendingBattleTransition?.kind !== "opening-draw" ||
      !ctx.battleSceneRef.current ||
      !ctx.drawPileRef.current
    ) {
      return;
    }
    void actions.openingDraw.playOpeningDraw();
  }, [actions.openingDraw, ctx]);

  useEffect(() => {
    if (
      !hasActiveBattle ||
      screen !== "battle" ||
      pendingTransitionResumeRequired ||
      pendingBattleTransition?.kind !== "opening-draw"
    ) {
      return;
    }
    playOpeningDrawWhenReady();
  }, [hasActiveBattle, pendingBattleTransition, pendingTransitionResumeRequired, playOpeningDrawWhenReady, screen]);

  useEffect(() => {
    if (hasActiveBattle) return;
    const enemyHealth = readBattle().battleState.enemyHealth;
    if (isVictoryGraceActive(screen, enemyHealth, ctx.victoryDefeatHandledRef.current)) return;
    actions.session.resetBattleSession();
    queueMicrotask(() => {
      clearBattlePresentationUi();
    });
  }, [hasActiveBattle, screen, actions.session, ctx]);

  useEffect(() => {
    if (screen !== "battle") {
      clearBattlePresentationUi();
    }
  }, [screen]);

  const bindPlayback = useCallback(
    (bind: BattlePlaybackBind | null) => {
      scheduleAutoEndTurnRef.current = bind?.scheduleAutoEndTurn ?? null;
      clearAutoEndTurnRef.current = bind?.clearAutoEndTurn ?? null;
      if (bind) queueMicrotask(playOpeningDrawWhenReady);
    },
    [playOpeningDrawWhenReady],
  );

  const refs = useMemo(
    () => ({
      handCardRefs: ctx.handCardRefs,
      drawPileRef: ctx.drawPileRef,
      discardPileRef: ctx.discardPileRef,
      battleSceneRef: ctx.battleSceneRef,
      playerPanelRef: ctx.playerPanelRef,
      enemyPanelRef: ctx.enemyPanelRef,
    }),
    [ctx],
  );

  return useMemo(
    () => ({
      hasActiveBattle,
      refs,
      bindPlayback,
      screen,
      isAutoplayEnabled,
      setAutoplayEnabled,
      isCardPlayInProgress: () => ctx.cardPlayInProgressRef.current,
      startBattle: actions.init.startBattle,
      startBossBattle: actions.init.startBossBattle,
      startBossById: actions.init.startBossById,
      handleCardClick: actions.cardPlay.handleCardClick,
      handleWishChoice: actions.cardPlay.handleWishChoice,
      handleAutoplayCard: actions.cardPlay.handleAutoplayCard,
      handleEndTurn: actions.endTurnUi.handleEndTurn,
      handleEndRun: actions.devOutcomes.handleEndRun,
      skipCombatDevMode: actions.devOutcomes.skipCombatDevMode,
    }),
    [hasActiveBattle, refs, bindPlayback, ctx, actions, screen, isAutoplayEnabled, setAutoplayEnabled],
  );
}
