import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
import {
  defaultMeasureElementRect,
  defaultMeasureVisualCardRect,
} from "@/features/alchemy/run-loop/battle/controller-utils";
import { createBattleEndTurnUi } from "@/features/alchemy/run-loop/battle/end-turn-ui";
import { createBattleTransferDeps } from "@/features/alchemy/run-loop/battle/battle-transfer-deps";
import { createBattleInit, playBattleOpeningDraw } from "@/features/alchemy/run-loop/battle/battle-init";
import { createBattleCardPlay } from "@/features/alchemy/run-loop/battle/battle-card-play";
import { createBattleDevOutcomes, isVictoryGraceActive } from "@/features/alchemy/run-loop/battle/battle-status";
import { useBattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";
import type { CardRect } from "@/features/alchemy/shared/types";
import type { Screen } from "@/lib/routing";
import { clearBattlePresentationUi } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { useBattleLifetimeFields } from "@/features/alchemy/shared/stores/run-reads";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import type { BattleSnapshot } from "@/lib/battle";
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
  const { hasActiveBattle, pendingTransitionResumeRequired } = useBattleLifetimeFields();

  const openingDrawPending = useBattlePresentationStore((state) => state.openingDrawPending);

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
    const settings = useSettingsStore.getState();
    if (settings.rememberAutoplayPreference) {
      settings.setAutoplayEnabled(enabled);
    }
  }, []);

  const toggleAutoplayEnabled = useCallback(() => {
    setIsAutoplayEnabledState((enabled) => {
      const settings = useSettingsStore.getState();
      if (settings.rememberAutoplayPreference) {
        settings.setAutoplayEnabled(!enabled);
      }
      return !enabled;
    });
  }, []);

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

  const playOpeningDrawWhenReady = useCallback(() => {
    let battle: ReturnType<typeof readBattle>;
    try {
      battle = readBattle();
    } catch (error) {
      if (import.meta.env.DEV) console.warn("[battle] unable to read opening-draw state", error);
      return undefined;
    }
    if (
      battle.pendingTransitionResumeRequired ||
      !useBattlePresentationStore.getState().openingDrawPending ||
      !ctx.battleSceneRef.current ||
      !ctx.drawPileRef.current
    ) {
      return undefined;
    }
    void playBattleOpeningDraw(ctx, actions.transferDeps).catch((error: unknown) => {
      if (import.meta.env.DEV) console.warn("[openingDraw] best-effort presentation failed", error);
    });
  }, [actions.transferDeps, ctx]);

  useEffect(() => {
    if (!hasActiveBattle || screen !== "battle" || pendingTransitionResumeRequired || !openingDrawPending) {
      return;
    }
    playOpeningDrawWhenReady();
  }, [
    hasActiveBattle,
    openingDrawPending,
    pendingTransitionResumeRequired,
    playbackBindVersion,
    playOpeningDrawWhenReady,
    screen,
  ]);

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
      handleEndTurn: actions.endTurnUi.handleEndTurn,
      handleEndRun: actions.devOutcomes.handleEndRun,
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
