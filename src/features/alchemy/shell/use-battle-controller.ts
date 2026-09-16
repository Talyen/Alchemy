import { createBattleCardPlay } from "@/features/alchemy/run-loop/battle/battle-card-play";
import type { BattlePlaybackBind } from "@/features/alchemy/run-loop/battle/battle-context";
import { useBattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";
import { createBattleInit } from "@/features/alchemy/run-loop/battle/battle-init";
import { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
import { createBattleDevOutcomes, isVictoryGraceActive } from "@/features/alchemy/run-loop/battle/battle-status";
import { createBattleTransferDeps } from "@/features/alchemy/run-loop/battle/battle-transfer-deps";
import {
  defaultMeasureElementRect,
  defaultMeasureVisualCardRect,
} from "@/features/alchemy/run-loop/battle/controller-utils";
import { createBattleEndTurnUi } from "@/features/alchemy/run-loop/battle/end-turn-ui";
import { useBattleOpeningDraw } from "@/features/alchemy/run-loop/battle/use-battle-opening-draw";
import { readBattle, useBattleLifetimeFields } from "@/features/alchemy/shared/stores/run-reads";
import { clearBattlePresentationUi } from "@/features/alchemy/shared/stores/run-lifecycle";
import { preferredAutoplayEnabled, useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import type { CardRect } from "@/features/alchemy/shared/types";
import type { BattleSnapshot } from "@/lib/battle";
import type { Screen } from "@/lib/routing";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

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
  const { hasActiveBattle, pendingTransitionResumeRequired } = useBattleLifetimeFields();

  const scheduleAutoEndTurnRef = useRef<((state?: BattleSnapshot) => void) | null>(null);
  const clearAutoEndTurnRef = useRef<(() => void) | null>(null);
  const onBattleSessionPreparedRef = useRef<(() => void) | null>(null);
  const pendingTransitionResumeAttemptedRef = useRef(false);
  const [isAutoplayEnabled, setIsAutoplayEnabledState] = useState(() =>
    preferredAutoplayEnabled(useSettingsStore.getState()),
  );
  const [playbackBindVersion, setPlaybackBindVersion] = useState(0);

  const setAutoplayEnabled = useCallback((enabled: boolean) => {
    setIsAutoplayEnabledState(enabled);
    if (useSettingsStore.getState().rememberAutoplayPreference) {
      useSettingsStore.getState().setAutoplayEnabled(enabled);
    }
  }, []);

  const toggleAutoplayEnabled = useCallback(() => {
    // Read-then-write outside the updater: settings writes are side effects
    // and must not run inside a StrictMode-double-invoked updater.
    const next = !isAutoplayEnabled;
    setIsAutoplayEnabledState(next);
    if (useSettingsStore.getState().rememberAutoplayPreference) {
      useSettingsStore.getState().setAutoplayEnabled(next);
    }
  }, [isAutoplayEnabled]);

  const [boonInspectOpen, setBoonInspectOpen] = useState(false);
  const toggleBoonInspect = useCallback(() => {
    setBoonInspectOpen((open) => !open);
  }, []);
  const closeBoonInspect = useCallback(() => {
    setBoonInspectOpen(false);
  }, []);

  const applyPreferredAutoplay = useCallback(() => {
    setIsAutoplayEnabledState(preferredAutoplayEnabled(useSettingsStore.getState()));
    setBoonInspectOpen(false);
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
    const devOutcomes = createBattleDevOutcomes(ctx, session);

    return {
      session,
      transferDeps,
      endTurnUi,
      cardPlay,
      init,
      devOutcomes,
    };
  }, [ctx]);

  useEffect(() => {
    if (screen !== "battle") {
      pendingTransitionResumeAttemptedRef.current = false;
      return;
    }
    if (!hasActiveBattle) {
      pendingTransitionResumeAttemptedRef.current = false;
      return;
    }
    if (!pendingTransitionResumeRequired || pendingTransitionResumeAttemptedRef.current) {
      return;
    }
    pendingTransitionResumeAttemptedRef.current = true;
    actions.endTurnUi.resumePendingBattleTransition();
  }, [actions.endTurnUi, hasActiveBattle, pendingTransitionResumeRequired, screen]);

  useBattleOpeningDraw({
    ctx,
    transferDeps: actions.transferDeps,
    hasActiveBattle,
    screen,
    pendingTransitionResumeRequired,
    playbackBindVersion,
  });

  // Teardown pair: the first resets session data when no battle is active
  // (skipping the victory grace window); the second clears presentation UI
  // whenever we leave the battle screen. Both are idempotent by design.
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

  const bindPlayback = useCallback((bind: BattlePlaybackBind | null) => {
    scheduleAutoEndTurnRef.current = bind?.scheduleAutoEndTurn ?? null;
    clearAutoEndTurnRef.current = bind?.clearAutoEndTurn ?? null;
    if (bind) setPlaybackBindVersion((version) => version + 1);
  }, []);

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
      toggleAutoplayEnabled,
      boonInspectOpen,
      toggleBoonInspect,
      closeBoonInspect,
      isCardPlayInProgress: () => ctx.cardPlayInProgressRef.current,
      startBattle: actions.init.startBattle,
      startBossBattle: actions.init.startBossBattle,
      startBossById: actions.init.startBossById,
      handleCardClick: actions.cardPlay.handleCardClick,
      handleWishChoice: actions.cardPlay.handleWishChoice,
      handleAutoplayCard: actions.cardPlay.handleAutoplayCard,
      handleAutoplayWish: actions.cardPlay.handleAutoplayWish,
      handleEndTurn: actions.endTurnUi.handleEndTurn,
      cancelBattle: actions.session.resetBattleSession,
      skipCombatDevMode: actions.devOutcomes.skipCombatDevMode,
    }),
    [
      hasActiveBattle,
      refs,
      bindPlayback,
      ctx,
      actions,
      screen,
      isAutoplayEnabled,
      setAutoplayEnabled,
      toggleAutoplayEnabled,
      boonInspectOpen,
      toggleBoonInspect,
      closeBoonInspect,
    ],
  );
}
