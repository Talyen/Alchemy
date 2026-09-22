import { createBattleCardPlay } from "@/features/alchemy/run-loop/battle/battle-card-play";
import { useBattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";
import { createBattleInit } from "@/features/alchemy/run-loop/battle/battle-init";
import { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
import { createBattleDevOutcomes } from "@/features/alchemy/run-loop/battle/battle-session";
import { createBattleTransferDeps } from "@/features/alchemy/run-loop/battle/draw-sequence";
import {
  defaultMeasureElementRect,
  defaultMeasureVisualCardRect,
} from "@/features/alchemy/run-loop/battle/controller-utils";
import { createBattleEndTurnUi } from "@/features/alchemy/run-loop/battle/end-turn-ui";
import { useBattleOpeningDraw } from "@/features/alchemy/run-loop/battle/use-battle-opening-draw";
import { useHasActiveBattle } from "@/features/alchemy/shared/stores/run-reads";
import { preferredAutoplayEnabled, useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import type { CardRect } from "@/features/alchemy/shared/types";
import type { Screen } from "@/lib/routing";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

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
  const hasActiveBattle = useHasActiveBattle();

  const [isAutoplayEnabled, setIsAutoplayEnabledState] = useState(() =>
    preferredAutoplayEnabled(useSettingsStore.getState()),
  );
  const autoplayEnabledRef = useRef(isAutoplayEnabled);

  const updateAutoplayEnabled = useCallback((enabled: boolean, persist: boolean) => {
    autoplayEnabledRef.current = enabled;
    setIsAutoplayEnabledState(enabled);
    if (persist && useSettingsStore.getState().rememberAutoplayPreference) {
      useSettingsStore.getState().setAutoplayEnabled(enabled);
    }
  }, []);

  const setAutoplayEnabled = useCallback(
    (enabled: boolean) => updateAutoplayEnabled(enabled, true),
    [updateAutoplayEnabled],
  );

  const toggleAutoplayEnabled = useCallback(() => {
    updateAutoplayEnabled(!autoplayEnabledRef.current, true);
  }, [updateAutoplayEnabled]);

  const [boonInspectOpen, setBoonInspectOpen] = useState(false);
  const toggleBoonInspect = useCallback(() => {
    setBoonInspectOpen((open) => !open);
  }, []);
  const closeBoonInspect = useCallback(() => {
    setBoonInspectOpen(false);
  }, []);

  const applyPreferredAutoplay = useCallback(() => {
    updateAutoplayEnabled(preferredAutoplayEnabled(useSettingsStore.getState()), false);
    setBoonInspectOpen(false);
  }, [updateAutoplayEnabled]);

  const ctx = useBattleControllerContext({
    screen,
    setHoveredCardId,
    onBattleVictory,
    onBattleDefeat,
    measureElementRect,
    measureVisualCardRect,
    onSessionPrepared: applyPreferredAutoplay,
  });

  const playbackBound = useSyncExternalStore(ctx.playback.subscribe, ctx.playback.isBound);
  const bindPlayback = ctx.playback.bind;

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
    actions.session.reconcile(screen, hasActiveBattle);
  }, [screen, hasActiveBattle, actions.session]);

  useBattleOpeningDraw({
    ctx,
    transferDeps: actions.transferDeps,
    hasActiveBattle,
    screen,
    playbackBound,
  });

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
      isCardPlayInProgress: () => ctx.playback.cardPlayInProgress,
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
