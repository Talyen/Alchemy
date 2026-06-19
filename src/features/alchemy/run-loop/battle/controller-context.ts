// Unified context/controller interface for battle UI side-effects, state integration, and orchestration.
import type { RefObject } from "react";
import type { BattleState } from "@/lib/battle";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import type { BattleCard } from "@/lib/game-data";
import type { Screen, CardRect, CardTransfer } from "../../shared/types";
import type { RunStateController, TalentStateController } from "../../shared/stores/run-session-facade";
import type { TimerGroup } from "@/lib/animation/game-timer";
import type { TransferCancelRegistry } from "./card-transfer-animations";
import type { HandDrawSequenceDeps } from "./draw-sequence";
import type { TurnOrchestrationDeps } from "./turn-orchestration";

export interface BattleControllerContext {
  // Setup and Props
  screen: Screen;
  run: RunStateController;
  talents: TalentStateController;
  autoEndTurn: boolean;
  homesteadEffectsRef: RefObject<HomesteadEffectManifest>;
  onBattleVictory?: (() => void) | undefined;
  onBattleDefeat?: (() => void) | undefined;
  measureElementRect: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
  measureVisualCardRect: (element: HTMLElement | null, sceneElement: HTMLDivElement | null) => CardRect | null;
  setHoveredCardId: React.Dispatch<React.SetStateAction<string | null>>;

  // Refs representing elements and transition timings
  handCardRefs: RefObject<Record<string, HTMLButtonElement | null>>;
  drawPileRef: RefObject<HTMLDivElement | null>;
  discardPileRef: RefObject<HTMLDivElement | null>;
  battleSceneRef: RefObject<HTMLDivElement | null>;
  playerPanelRef: RefObject<HTMLDivElement | null>;
  enemyPanelRef: RefObject<HTMLDivElement | null>;

  cardPlayInProgressRef: RefObject<boolean>;
  companionScheduledRef: RefObject<boolean>;
  battleTimerGroupRef: RefObject<TimerGroup>;
  battleSessionRef: RefObject<number>;
  victoryDefeatHandledRef: RefObject<boolean>;
  transferCancelRegistryRef: RefObject<TransferCancelRegistry>;
  transferIdCounterRef: RefObject<number>;
  resolvedAsHasteOrStunRef: RefObject<boolean>;

  // Zustand State / Actions
  battleState: BattleState;
  cardTransfers: CardTransfer[];
  setCardTransfers: (transfers: CardTransfer[] | ((prev: CardTransfer[]) => CardTransfer[])) => void;
  hiddenHandCardKeys: Set<string>;
  setHiddenHandCardKeys: (keys: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  cardTransferInProgress: boolean;
  setCardTransferInProgress: (active: boolean) => void;

  // Controller Lifecycle Functions
  isCurrentBattleSession: (session: number) => boolean;
  runIfSessionActive: <T>(session: number, action: () => T, fallback?: T) => T;
  checkBattleEnd: (state: BattleState, session: number) => boolean;
  handleVictoryDefeat: (outcome: "victory" | "defeat") => void;
  clearAllBattleTimeouts: () => void;
  clearBattleTimeoutsKeepCompanion: () => void;
  resetBattleSession: () => void;
  logBattleError: (context: string, err: unknown) => void;
  resetHandTransferUi: () => void;

  // Dynamic Flow & Sequence Callbacks
  getDrawSequenceDeps: () => HandDrawSequenceDeps;
  finishDrawSequence: (session: number, state: BattleState) => void;
  scheduleAutoEndTurn: (state: BattleState) => void;
  getTurnOrchestrationDeps: () => TurnOrchestrationDeps;
  animateDiscardedHand: (hand: BattleCard[], session: number) => Promise<void>;
}
