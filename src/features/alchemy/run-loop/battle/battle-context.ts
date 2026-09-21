import { PlaybackLifetime } from "./playback-lifetime";
import { useRef, useMemo, useLayoutEffect, useState } from "react";
import type { BattleCard } from "@/lib/game-data";
import type { BattleRefs, CardRect } from "@/features/alchemy/shared/types";
import type { Screen } from "@/lib/routing";
import type { BattlePresentationPort } from "./battle-presentation-store";
import { useBattlePresentationStore } from "./battle-presentation-store";

export interface AutoplayCardControl {
  signal: AbortSignal;
  canCommit: () => boolean;
}

export type AutoplayCardHandler = (
  card: BattleCard,
  index: number,
  control: AutoplayCardControl,
) => boolean | Promise<boolean>;

export type AutoplayWishHandler = (card: BattleCard, control: AutoplayCardControl) => boolean | Promise<boolean>;

export type { BattlePlaybackBind } from "./playback-lifetime";

export interface BattleControllerContextProps {
  screen: Screen;
  setHoveredCardId: React.Dispatch<React.SetStateAction<string | null>>;
  onBattleVictory?: (() => void) | undefined;
  onBattleDefeat?: (() => void) | undefined;
  measureElementRect: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
  measureVisualCardRect: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
  onSessionPrepared?: (() => void) | undefined;
  getPresentation?: () => BattlePresentationPort;
}

export interface BattleControllerContext extends Omit<BattleControllerContextProps, "getPresentation">, BattleRefs {
  playback: PlaybackLifetime;
  getPresentation: () => BattlePresentationPort;
}

export function useBattleControllerContext(props: BattleControllerContextProps): BattleControllerContext {
  const handCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const drawPileRef = useRef<HTMLDivElement | null>(null);
  const discardPileRef = useRef<HTMLDivElement | null>(null);
  const battleSceneRef = useRef<HTMLDivElement | null>(null);
  const playerPanelRef = useRef<HTMLDivElement | null>(null);
  const enemyPanelRef = useRef<HTMLDivElement | null>(null);

  const [playback] = useState(() => new PlaybackLifetime());
  useLayoutEffect(() => {
    playback.activate();
    return () => playback.cancel();
  }, [playback]);
  const context = useMemo<BattleControllerContext>(
    () => ({
      ...props,
      playback,
      handCardRefs,
      drawPileRef,
      discardPileRef,
      battleSceneRef,
      playerPanelRef,
      enemyPanelRef,
      getPresentation: props.getPresentation ?? useBattlePresentationStore.getState,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- One controller lifetime; committed props are synchronized below.
    [playback],
  );
  useLayoutEffect(() => {
    Object.assign(context, props, { getPresentation: props.getPresentation ?? useBattlePresentationStore.getState });
  });
  return context;
}
