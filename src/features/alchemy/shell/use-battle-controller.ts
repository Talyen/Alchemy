import { createSessionPersistence } from "@/features/alchemy/shared/storage";
import { assertSessionOwnership, guardProgressAction } from "@/features/alchemy/shared/stores/session-capabilities";
import { battlePresentation } from "@/app/battle-presentation";
import { defaultGameSession } from "@/app/application-session";
import { createBattleCapabilities } from "@/features/alchemy/shared/stores/battle-commands";
import { playUISound } from "@/lib/audio";
import { createBattleCardPlay } from "@/features/alchemy/run-loop/battle/battle-card-play";
import { useBattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";
import { createBattleInit } from "@/features/alchemy/run-loop/battle/battle-init";
import { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
import { createBattleDevOutcomes } from "@/features/alchemy/run-loop/battle/battle-session";
import { createBattleTransferDeps } from "@/features/alchemy/run-loop/battle/battle-transfers";
import {
  defaultMeasureElementRect,
  defaultMeasureVisualCardRect,
} from "@/features/alchemy/run-loop/battle/controller-utils";
import { createBattleEndTurnUi } from "@/features/alchemy/run-loop/battle/end-turn-ui";
import { useBattleOpeningDraw } from "@/features/alchemy/run-loop/battle/use-battle-opening-draw";
import { useHasActiveBattle } from "@/features/alchemy/shared/stores/run-reads";
import { preferredAutoplayEnabled, useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import type { CardRect } from "@/features/alchemy/shared/types";
import type { Screen } from "@/lib/routing";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

interface UseBattleControllerProps {
  screen: Screen;
  setHoveredCardId?: React.Dispatch<React.SetStateAction<string | null>>;
  onBattleVictory?: () => void;
  onBattleDefeat?: () => void;
  measureElementRect?: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
  measureVisualCardRect?: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
}

export function useBattleController({
  screen,
  setHoveredCardId = useUiStore.getState().setHoveredCardId,
  onBattleVictory,
  onBattleDefeat,
  measureElementRect = defaultMeasureElementRect,
  measureVisualCardRect = defaultMeasureVisualCardRect,
}: UseBattleControllerProps) {
  assertSessionOwnership(
    defaultGameSession,
    ...[onBattleVictory, onBattleDefeat].filter((callback) => callback !== undefined),
  );
  const hasActiveBattle = useHasActiveBattle();
  const persistence = useMemo(() => createSessionPersistence(defaultGameSession), []);

  const [isAutoplayEnabled, setIsAutoplayEnabledState] = useState(() =>
    preferredAutoplayEnabled(useSettingsStore.getState()),
  );
  const autoplayEnabledRef = useRef(isAutoplayEnabled);

  const updateAutoplayEnabled = useCallback((enabled: boolean, persist: boolean) => {
    const previous = autoplayEnabledRef.current;
    autoplayEnabledRef.current = enabled;
    setIsAutoplayEnabledState(enabled);
    if (persist && useSettingsStore.getState().rememberAutoplayPreference) {
      useSettingsStore.getState().setAutoplayEnabled(enabled);
    }
    if (persist && previous !== enabled) playUISound(enabled ? "toggleOn" : "toggleOff");
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

  const battle = useMemo(() => createBattleCapabilities(defaultGameSession), []);
  const ctx = useBattleControllerContext({
    battle,
    presentation: battlePresentation,
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
      presentation: battlePresentation,
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
      isProgressSavePending: () => persistence.readProgress().kind !== "idle",
      subscribeProgressSave: persistence.subscribeProgress,
      presentBattleStart: actions.init.presentBattleStart,
      startBattle: actions.init.startBattle,
      startBossBattle: actions.init.startBossBattle,
      startBossById: actions.init.startBossById,
      handleCardClick: guardProgressAction(defaultGameSession, actions.cardPlay.handleCardClick, undefined),
      handleWishChoice: guardProgressAction(defaultGameSession, actions.cardPlay.handleWishChoice, undefined),
      handleAutoplayCard: guardProgressAction(
        defaultGameSession,
        actions.cardPlay.handleAutoplayCard,
        Promise.resolve(false),
      ),
      handleAutoplayWish: guardProgressAction(
        defaultGameSession,
        actions.cardPlay.handleAutoplayWish,
        Promise.resolve(false),
      ),
      handleEndTurn: guardProgressAction(defaultGameSession, actions.endTurnUi.handleEndTurn, undefined),
      cancelBattle: actions.session.resetBattleSession,
      skipCombatDevMode: actions.devOutcomes.skipCombatDevMode,
    }),
    [
      hasActiveBattle,
      persistence,
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
