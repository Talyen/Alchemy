import { TimerGroup } from "@/lib/animation/game-timer";

import type { BattleSnapshot } from "@/lib/battle";
import { runPlaybackTask } from "./playback-task";

export interface BattlePlaybackBind {
  scheduleAutoEndTurn: (state?: BattleSnapshot) => void;
  clearAutoEndTurn: () => void;
}

export interface PlaybackScope {
  readonly isCurrent: () => boolean;
  readonly registerCancel: (callback: () => void) => () => void;
  readonly setTimeout: (callback: () => void, ms: number) => () => void;
  readonly setGameTimeout: (callback: () => void, ms: number) => () => void;
}

type PlaybackPhase = "opening" | "ready" | "playing" | "finishing" | "cancelled";

/** One cancellation scope for a battle's timers, transfers, and asynchronous continuations. */
export class PlaybackLifetime {
  private generation = 0;
  private controller = new AbortController();
  private phase: PlaybackPhase = "ready";
  private cancellations = new Set<() => void>();
  private transferSequence = 0;
  private draws = 0;
  private cardDraws = 0;
  readonly timers = new TimerGroup();
  private binding: BattlePlaybackBind | null = null;
  private listeners = new Set<() => void>();

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  readonly isBound = (): boolean => this.binding !== null;
  readonly bind = (binding: BattlePlaybackBind | null): void => {
    this.binding?.clearAutoEndTurn();
    this.binding = binding;
    for (const listener of this.listeners) listener();
  };

  scheduleAutoEndTurn(state?: BattleSnapshot): void {
    if (this.phase === "ready") this.binding?.scheduleAutoEndTurn(state);
  }

  clearAutoEndTurn(): void {
    this.binding?.clearAutoEndTurn();
  }

  get cardPlayInProgress(): boolean {
    return this.phase === "playing" || this.phase === "opening";
  }

  canAcceptInput(allowOverlappingDraws = false): boolean {
    // Card play remains available during victory grace; ending the turn does not.
    return (
      this.phase === "ready" ||
      (allowOverlappingDraws && (this.phase === "finishing" || (this.phase === "playing" && this.cardDraws > 0)))
    );
  }

  beginOpening(): void {
    if (this.phase === "ready") this.phase = "opening";
  }

  beginAction(): void {
    if (this.phase === "ready" || this.phase === "playing") {
      this.clearAutoEndTurn();
      this.phase = "playing";
    }
  }

  completeAction(id: number): void {
    if (this.isCurrent(id) && (this.phase === "playing" || this.phase === "opening")) this.phase = "ready";
  }

  get id() {
    return this.generation;
  }
  get signal() {
    return this.controller.signal;
  }
  get pendingDraws() {
    return this.draws + this.cardDraws;
  }
  get pendingCardDraws() {
    return this.cardDraws;
  }
  get finishing() {
    return this.phase === "finishing";
  }

  isCurrent(id: number): boolean {
    return id === this.generation && this.phase !== "cancelled" && !this.signal.aborted;
  }

  /** Retained operations keep authority over their originating generation only. */
  capture(id: number): PlaybackScope {
    const admitted = this.isCurrent(id);
    const isCurrent = () => admitted && this.isCurrent(id);
    const schedule = (callback: () => void, ms: number, gameDelay: boolean) => {
      if (!isCurrent()) return () => {};
      const run = () => {
        if (isCurrent()) callback();
      };
      return gameDelay ? this.timers.setGameTimeout(run, ms) : this.timers.setTimeout(run, ms);
    };
    return Object.freeze({
      isCurrent,
      registerCancel: (callback: () => void) => {
        if (isCurrent()) return this.registerCancel(callback);
        callback();
        return () => {};
      },
      setTimeout: (callback: () => void, ms: number) => schedule(callback, ms, false),
      setGameTimeout: (callback: () => void, ms: number) => schedule(callback, ms, true),
    });
  }

  finish(): boolean {
    if (this.phase === "finishing" || this.phase === "cancelled") return false;
    this.clearAutoEndTurn();
    this.phase = "finishing";
    return true;
  }

  registerCancel(callback: () => void): () => void {
    if (this.phase === "cancelled") {
      callback();
      return () => {};
    }
    this.cancellations.add(callback);
    return () => this.cancellations.delete(callback);
  }

  cancelTransfers(): void {
    const callbacks = [...this.cancellations];
    this.cancellations.clear();
    for (const callback of callbacks) callback();
  }

  cancel(): void {
    this.phase = "cancelled";
    this.controller.abort();
    this.timers.clearAll();
    this.cancelTransfers();
    this.clearAutoEndTurn();
    this.draws = 0;
    this.cardDraws = 0;
  }

  activate(): void {
    if (this.phase === "cancelled") this.restart();
  }

  restart(): void {
    this.cancel();
    this.generation += 1;
    this.controller = new AbortController();
    this.phase = "ready";
  }

  beginDraw(id: number, kind: "draw" | "card" = "draw"): () => void {
    if (!this.isCurrent(id)) return () => {};
    if (kind === "card") this.cardDraws++;
    else this.draws++;
    let settled = false;
    return () => {
      if (settled || !this.isCurrent(id)) return;
      settled = true;
      if (kind === "card") this.cardDraws--;
      else this.draws--;
    };
  }

  nextTransferId(): string {
    return `transfer-${++this.transferSequence}`;
  }

  waitForFrame(id: number): Promise<boolean> {
    if (!this.isCurrent(id)) return Promise.resolve(false);
    return runPlaybackTask(
      this.capture(id).registerCancel,
      () => false,
      (task) => task.frame(() => task.complete(this.isCurrent(id))),
    );
  }
}
