import type { BattleCapabilities } from "@/features/alchemy/shared/stores/commands/battle-commands";
import type { GameSession } from "@/features/alchemy/shared/stores/session/game-session-types";
import { onRunRestored } from "@/features/alchemy/shared/stores/commands/run-lifecycle";
import {
  assertSessionOwnership,
  registerSessionCleanup,
} from "@/features/alchemy/shared/stores/session/session-capabilities";
import { PlaybackLifetime } from "./playback-lifetime";
import { useRef, useMemo, useLayoutEffect, useState } from "react";
import type { BattleSnapshot } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import type { BattleRefs, CardRect } from "@/features/alchemy/shared/types";
import type { Screen } from "@/lib/routing";
import type { BattlePresentationPort, BattlePresentationStore } from "./battle-presentation-store";

export interface AutoplayCardControl {
  signal: AbortSignal;
  canCommit: () => boolean;
}

export type AutoplayCardHandler = (
  card: BattleCard,
  index: number,
  control: AutoplayCardControl,
  expected: BattleSnapshot,
) => boolean | Promise<boolean>;

export type AutoplayWishHandler = (
  card: BattleCard,
  control: AutoplayCardControl,
  expected: BattleSnapshot,
) => boolean | Promise<boolean>;

export type { BattlePlaybackBind } from "./playback-lifetime";

export interface BattleControllerContextProps {
  battle: BattleCapabilities;
  screen: Screen;
  setHoveredCardId: React.Dispatch<React.SetStateAction<string | null>>;
  onBattleVictory?: (() => void) | undefined;
  onBattleDefeat?: (() => void) | undefined;
  measureElementRect: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
  measureVisualCardRect: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
  onSessionPrepared?: (() => void) | undefined;
  presentation: BattlePresentationStore;
}

export interface BattleControllerContext extends BattleControllerContextProps, BattleRefs {
  playback: PlaybackLifetime;
  getPresentation: () => BattlePresentationPort;
}

export function useBattleControllerContext(
  props: BattleControllerContextProps,
  gameSession: GameSession,
): BattleControllerContext {
  assertSessionOwnership(gameSession, props.battle, props.presentation);
  const endTurnButtonRef = useRef<HTMLButtonElement | null>(null);
  const handCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const drawPileRef = useRef<HTMLDivElement | null>(null);
  const discardPileRef = useRef<HTMLDivElement | null>(null);
  const battleSceneRef = useRef<HTMLDivElement | null>(null);
  const playerPanelRef = useRef<HTMLDivElement | null>(null);
  const enemyPanelRef = useRef<HTMLDivElement | null>(null);

  const [playback] = useState(() => new PlaybackLifetime());
  useLayoutEffect(() => {
    playback.activate();
    const unsubscribe = onRunRestored(() => playback.restart(), gameSession);
    const release = registerSessionCleanup(gameSession, () => playback.cancel());
    return () => {
      unsubscribe();
      release();
    };
  }, [playback, gameSession]);
  const committed = useRef(props);
  useLayoutEffect(() => {
    committed.current = props;
  });
  const context = useMemo<BattleControllerContext>(
    () => ({
      battle: props.battle,
      presentation: props.presentation,
      get screen() {
        return committed.current.screen;
      },
      get setHoveredCardId() {
        return committed.current.setHoveredCardId;
      },
      get onBattleVictory() {
        return committed.current.onBattleVictory;
      },
      get onBattleDefeat() {
        return committed.current.onBattleDefeat;
      },
      get measureElementRect() {
        return committed.current.measureElementRect;
      },
      get measureVisualCardRect() {
        return committed.current.measureVisualCardRect;
      },
      get onSessionPrepared() {
        return committed.current.onSessionPrepared;
      },
      playback,
      endTurnButtonRef,
      handCardRefs,
      drawPileRef,
      discardPileRef,
      battleSceneRef,
      playerPanelRef,
      enemyPanelRef,
      getPresentation: props.presentation.getState,
    }),
    // oxlint-disable-next-line react/exhaustive-deps -- One controller lifetime; changing inputs come from the committed ref.
    [playback],
  );
  return context;
}
