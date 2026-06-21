import { useRef, type RefObject } from "react";
import type { BattleState } from "@/lib/battle";
import type { CardRect, Screen } from "@/features/alchemy/shared/types";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import type { RunStateController, TalentStateController } from "@/features/alchemy/shared/stores/run-session-facade";
import { TimerGroup } from "@/lib/animation/game-timer";
import { createTransferCancelRegistry, type TransferCancelRegistry } from "./card-transfer-animations";

export interface BattleControllerContext {
  // State from props / parent
  run: RunStateController;
  talents: TalentStateController;
  autoEndTurn: boolean;
  homesteadEffectsRef: RefObject<HomesteadEffectManifest>;
  screen: Screen;
  setHoveredCardId: React.Dispatch<React.SetStateAction<string | null>>;
  onBattleVictory?: (() => void) | undefined;
  onBattleDefeat?: (() => void) | undefined;
  measureElementRect: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
  measureVisualCardRect: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;

  // DOM Refs
  handCardRefs: RefObject<Record<string, HTMLButtonElement | null>>;
  drawPileRef: RefObject<HTMLDivElement | null>;
  discardPileRef: RefObject<HTMLDivElement | null>;
  battleSceneRef: RefObject<HTMLDivElement | null>;
  playerPanelRef: RefObject<HTMLDivElement | null>;
  enemyPanelRef: RefObject<HTMLDivElement | null>;

  // Internal state Refs
  cardPlayInProgressRef: RefObject<boolean>;
  companionScheduledRef: RefObject<boolean>;
  battleTimerGroupRef: RefObject<TimerGroup>;
  battleSessionRef: RefObject<number>;
  victoryDefeatHandledRef: RefObject<boolean>;
  transferCancelRegistryRef: RefObject<TransferCancelRegistry>;
  transferIdCounterRef: RefObject<number>;

  // Mutable hooks & callbacks
  scheduleAutoEndTurn?: ((state: BattleState) => void) | undefined;
}

export type BattleControllerContextProps = {
  run: RunStateController;
  talents: TalentStateController;
  autoEndTurn: boolean;
  homesteadEffectsRef: RefObject<HomesteadEffectManifest>;
  screen: Screen;
  setHoveredCardId: React.Dispatch<React.SetStateAction<string | null>>;
  onBattleVictory?: (() => void) | undefined;
  onBattleDefeat?: (() => void) | undefined;
  measureElementRect: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
  measureVisualCardRect: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
};

export function useBattleControllerContext(props: BattleControllerContextProps): BattleControllerContext {
  const handCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const drawPileRef = useRef<HTMLDivElement | null>(null);
  const discardPileRef = useRef<HTMLDivElement | null>(null);
  const battleSceneRef = useRef<HTMLDivElement | null>(null);
  const playerPanelRef = useRef<HTMLDivElement | null>(null);
  const enemyPanelRef = useRef<HTMLDivElement | null>(null);

  const cardPlayInProgressRef = useRef(false);
  const companionScheduledRef = useRef(false);
  const battleTimerGroupRef = useRef(new TimerGroup());
  const battleSessionRef = useRef(0);
  const victoryDefeatHandledRef = useRef(false);
  const transferCancelRegistryRef = useRef(createTransferCancelRegistry());
  const transferIdCounterRef = useRef(0);

  const contextRef = useRef<BattleControllerContext | null>(null);
  if (!contextRef.current) {
    contextRef.current = {
      // DOM Refs
      handCardRefs,
      drawPileRef,
      discardPileRef,
      battleSceneRef,
      playerPanelRef,
      enemyPanelRef,
      // Internal state Refs
      cardPlayInProgressRef,
      companionScheduledRef,
      battleTimerGroupRef,
      battleSessionRef,
      victoryDefeatHandledRef,
      transferCancelRegistryRef,
      transferIdCounterRef,
    } as unknown as BattleControllerContext;
  }

  // Always keep props / callback refs up-to-date
  contextRef.current.run = props.run;
  contextRef.current.talents = props.talents;
  contextRef.current.autoEndTurn = props.autoEndTurn;
  contextRef.current.homesteadEffectsRef = props.homesteadEffectsRef;
  contextRef.current.screen = props.screen;
  contextRef.current.setHoveredCardId = props.setHoveredCardId;
  contextRef.current.onBattleVictory = props.onBattleVictory;
  contextRef.current.onBattleDefeat = props.onBattleDefeat;
  contextRef.current.measureElementRect = props.measureElementRect;
  contextRef.current.measureVisualCardRect = props.measureVisualCardRect;

  return contextRef.current;
}
