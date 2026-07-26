import { useRef, useMemo, useLayoutEffect, type RefObject } from "react";
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
  homesteadEffects: HomesteadEffectManifest;
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
  scheduleAutoEndTurnRef: RefObject<((state: BattleState) => void) | null>;
  clearAutoEndTurnRef: RefObject<(() => void) | null>;
}

export interface BattleControllerContextProps {
  run: RunStateController;
  talents: TalentStateController;
  autoEndTurn: boolean;
  homesteadEffects: HomesteadEffectManifest;
  screen: Screen;
  setHoveredCardId: React.Dispatch<React.SetStateAction<string | null>>;
  onBattleVictory?: (() => void) | undefined;
  onBattleDefeat?: (() => void) | undefined;
  measureElementRect: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
  measureVisualCardRect: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
  scheduleAutoEndTurnRef: RefObject<((state: BattleState) => void) | null>;
  clearAutoEndTurnRef: RefObject<(() => void) | null>;
}

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
  const propsRef = useRef(props);
  useLayoutEffect(() => {
    propsRef.current = props;
  });

  const context = useMemo(() => {
    return {
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

      // Getters for dynamic props
      get run() {
        return propsRef.current.run;
      },
      get talents() {
        return propsRef.current.talents;
      },
      get autoEndTurn() {
        return propsRef.current.autoEndTurn;
      },
      get homesteadEffects() {
        return propsRef.current.homesteadEffects;
      },
      get screen() {
        return propsRef.current.screen;
      },
      get setHoveredCardId() {
        return propsRef.current.setHoveredCardId;
      },
      get onBattleVictory() {
        return propsRef.current.onBattleVictory;
      },
      get onBattleDefeat() {
        return propsRef.current.onBattleDefeat;
      },
      get measureElementRect() {
        return propsRef.current.measureElementRect;
      },
      get measureVisualCardRect() {
        return propsRef.current.measureVisualCardRect;
      },
      get scheduleAutoEndTurnRef() {
        return propsRef.current.scheduleAutoEndTurnRef;
      },
      get clearAutoEndTurnRef() {
        return propsRef.current.clearAutoEndTurnRef;
      },
    };
  }, []);

  return context;
}
