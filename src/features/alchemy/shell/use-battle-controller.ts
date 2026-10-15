import { createSessionPersistence } from "@/features/alchemy/shared/storage";
import {
  assertSessionOwnership,
  guardProgressAction,
  sessionFeedback,
} from "@/features/alchemy/shared/stores/session-capabilities";
import type { BattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { createBattleCapabilities } from "@/features/alchemy/shared/stores/battle-commands";
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
import { useSessionHasActiveBattle } from "@/features/alchemy/shared/stores/use-session-run-reads";
import { readSessionSettings } from "@/features/alchemy/shared/stores/session-settings";
import { preferredAutoplayEnabled } from "@/features/alchemy/shared/stores/settings-state";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import type { CardRect } from "@/features/alchemy/shared/types";
import type { Screen } from "@/lib/routing";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

interface UseBattleControllerProps {
  gameSession: GameSession;
  presentation: BattlePresentationStore;
  screen: Screen;
  setHoveredCardId?: React.Dispatch<React.SetStateAction<string | null>>;
  onBattleVictory?: () => void;
  onBattleDefeat?: () => void;
  measureElementRect?: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
  measureVisualCardRect?: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
}

export function useBattleController({
  gameSession,
  presentation,
  screen,
  setHoveredCardId = useUiStore.getState().setHoveredCardId,
  onBattleVictory,
  onBattleDefeat,
  measureElementRect = defaultMeasureElementRect,
  measureVisualCardRect = defaultMeasureVisualCardRect,
}: UseBattleControllerProps) {
  assertSessionOwnership(
    gameSession,
    presentation,
    ...[onBattleVictory, onBattleDefeat].filter((callback) => callback !== undefined),
  );
  const [owner] = useState(() => ({ gameSession, presentation }));
  if (owner.gameSession !== gameSession || owner.presentation !== presentation) {
    throw new Error("Remount the battle controller when changing its game session or presentation store");
  }
  const hasActiveBattle = useSessionHasActiveBattle(gameSession);
  const persistence = useMemo(() => createSessionPersistence(gameSession), [gameSession]);

  const [isAutoplayEnabled, setIsAutoplayEnabledState] = useState(() =>
    preferredAutoplayEnabled(readSessionSettings(gameSession)),
  );
  const autoplayEnabledRef = useRef(isAutoplayEnabled);

  const updateAutoplayEnabled = useCallback(
    (enabled: boolean, persist: boolean) => {
      const previous = autoplayEnabledRef.current;
      autoplayEnabledRef.current = enabled;
      setIsAutoplayEnabledState(enabled);
      if (persist && readSessionSettings(gameSession).rememberAutoplayPreference) {
        readSessionSettings(gameSession).setAutoplayEnabled(enabled);
      }
      if (persist && previous !== enabled) sessionFeedback(gameSession).playUISound(enabled ? "toggleOn" : "toggleOff");
    },
    [gameSession],
  );

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
    updateAutoplayEnabled(preferredAutoplayEnabled(readSessionSettings(gameSession)), false);
    setBoonInspectOpen(false);
  }, [updateAutoplayEnabled, gameSession]);

  const battle = useMemo(() => createBattleCapabilities(gameSession), [gameSession]);
  const ctx = useBattleControllerContext(
    {
      battle,
      presentation,
      screen,
      setHoveredCardId,
      onBattleVictory,
      onBattleDefeat,
      measureElementRect,
      measureVisualCardRect,
      onSessionPrepared: applyPreferredAutoplay,
    },
    gameSession,
  );

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
      endTurnButtonRef: ctx.endTurnButtonRef,
      handCardRefs: ctx.handCardRefs,
      handDockRef: ctx.handDockRef,
      battleSceneRef: ctx.battleSceneRef,
      playerPanelRef: ctx.playerPanelRef,
      enemyPanelRef: ctx.enemyPanelRef,
    }),
    [ctx],
  );

  return useMemo(
    () => ({
      hasActiveBattle,
      presentation,
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
      subscribePlayback: ctx.playback.subscribe,
      isProgressSavePending: () => persistence.readProgress().kind !== "idle",
      subscribeProgressSave: persistence.subscribeProgress,
      presentBattleStart: actions.init.presentBattleStart,
      startBattle: actions.init.startBattle,
      startBossBattle: actions.init.startBossBattle,
      startBossById: actions.init.startBossById,
      handleCardClick: guardProgressAction(gameSession, actions.cardPlay.handleCardClick, undefined),
      handleWishChoice: guardProgressAction(gameSession, actions.cardPlay.handleWishChoice, undefined),
      handleAutoplayCard: guardProgressAction(gameSession, actions.cardPlay.handleAutoplayCard, Promise.resolve(false)),
      handleAutoplayWish: guardProgressAction(gameSession, actions.cardPlay.handleAutoplayWish, Promise.resolve(false)),
      handleEndTurn: guardProgressAction(gameSession, actions.endTurnUi.handleEndTurn, undefined),
      cancelBattle: actions.session.resetBattleSession,
      skipCombatDevMode: actions.devOutcomes.skipCombatDevMode,
    }),
    [
      hasActiveBattle,
      gameSession,
      presentation,
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
