import { useRef, useMemo, useLayoutEffect, type RefObject } from "react";
import type { BattleState } from "@/lib/battle";
import type { BattleRefs, CardRect } from "@/features/alchemy/shared/types";
import type { Screen } from "@/lib/routing";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import type { BattleRunPort, BattleTalentPort } from "@/features/alchemy/shared/stores/run-port-types";
import { TimerGroup } from "@/lib/animation/game-timer";
import { createTransferCancelRegistry, type TransferCancelRegistry } from "./card-transfer-animations";
import type { BattlePresentationPort } from "./battle-presentation-port";
import { resolveBattlePresentation } from "./battle-presentation-port";

/** Playback callbacks the battle route binds into shell-owned refs. */
export interface BattlePlaybackBind {
  scheduleAutoEndTurn: (state?: BattleState) => void;
  clearAutoEndTurn: () => void;
}

export interface BattleControllerContextProps {
  run: BattleRunPort;
  talents: BattleTalentPort;
  homesteadEffects: HomesteadEffectManifest;
  screen: Screen;
  setHoveredCardId: React.Dispatch<React.SetStateAction<string | null>>;
  onBattleVictory?: (() => void) | undefined;
  onBattleDefeat?: (() => void) | undefined;
  measureElementRect: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
  measureVisualCardRect: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
  scheduleAutoEndTurnRef: RefObject<((state?: BattleState) => void) | null>;
  clearAutoEndTurnRef: RefObject<(() => void) | null>;
  onBattleSessionPreparedRef: RefObject<(() => void) | null>;
  getPresentation?: () => BattlePresentationPort;
}

export interface BattleControllerContext extends Omit<BattleControllerContextProps, "getPresentation">, BattleRefs {
  cardPlayInProgressRef: RefObject<boolean>;
  companionScheduledRef: RefObject<boolean>;
  battleTimerGroupRef: RefObject<TimerGroup>;
  companionTimerGroupRef: RefObject<TimerGroup>;
  battleSessionRef: RefObject<number>;
  battleAbortControllerRef: RefObject<AbortController>;
  victoryDefeatHandledRef: RefObject<boolean>;
  transferCancelRegistryRef: RefObject<TransferCancelRegistry>;
  transferIdCounterRef: RefObject<number>;
  getPresentation: () => BattlePresentationPort;
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
  const companionTimerGroupRef = useRef(new TimerGroup());
  const battleSessionRef = useRef(0);
  const battleAbortControllerRef = useRef(new AbortController());
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
      companionTimerGroupRef,
      battleSessionRef,
      battleAbortControllerRef,
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
      get onBattleSessionPreparedRef() {
        return propsRef.current.onBattleSessionPreparedRef;
      },
      getPresentation() {
        return resolveBattlePresentation(propsRef.current);
      },
    };
  }, []);

  return context;
}
