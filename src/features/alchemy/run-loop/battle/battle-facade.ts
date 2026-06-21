// Shared types for battle controller composition.
// BattleLifecycle is the core set of functions and refs that most factories consume.

import type { RefObject } from "react";
import type { BattleState } from "@/lib/battle";
import type { Screen } from "../../shared/types";
import type { TimerGroup } from "@/lib/animation/game-timer";
import type { TransferCancelRegistry } from "./card-transfer-animations";

export type BattleLifecycle = {
  screen: Screen;
  battleSessionRef: RefObject<number>;
  battleTimerGroupRef: RefObject<TimerGroup>;
  transferCancelRegistryRef: RefObject<TransferCancelRegistry>;
  victoryDefeatHandledRef: RefObject<boolean>;
  cardPlayInProgressRef: RefObject<boolean>;
  companionScheduledRef: RefObject<boolean>;

  isCurrentBattleSession: (session: number) => boolean;
  runIfSessionActive: <T>(session: number, action: () => T, fallback?: T) => T;
  checkBattleEnd: (state: BattleState, session: number) => boolean;
  handleVictoryDefeat: (outcome: "victory" | "defeat") => void;
  resetBattleSession: () => void;
  clearAllBattleTimeouts: () => void;
  clearBattleTimeoutsKeepCompanion: () => void;
  logBattleError: (context: string, err: unknown) => void;
  resetHandTransferUi: () => void;
  finishDrawSequence: (session: number, state: BattleState) => void;
};
