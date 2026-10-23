import { TimerGroup, type TimerClock } from "@/lib/animation/game-timer";

import type { BattleSnapshot } from "@/lib/battle";
import { runPlaybackTask } from "./playback-task";
import { createNotificationChannel } from "@/features/alchemy/shared/stores/session/notification-channel";
import { logError } from "@/lib/error-logger";

function runPlaybackCleanup(cleanup: () => void): void {
  try {
    cleanup();
  } catch (error) {
    logError("Battle playback cleanup failed", "battle", undefined, undefined, undefined, error);
  }
}

export interface BattlePlaybackBind {
  scheduleAutoEndTurn: (state?: BattleSnapshot) => void;
  clearAutoEndTurn: () => void;
}

export interface PlaybackScope {
  readonly isCurrent: () => boolean;
  readonly wait: (ms: number, signal?: AbortSignal, onCancel?: () => void) => Promise<boolean>;
  readonly registerCancel: (callback: () => void) => () => void;
  readonly setTimeout: (callback: () => void, ms: number) => () => void;
  readonly setGameTimeout: (callback: () => void, ms: number) => () => void;
}

type PlaybackPhase = "opening" | "ready" | "playing" | "finishing" | "cancelled";

interface PlaybackGeneration {
  readonly id: number;
  readonly controller: AbortController;
  readonly timers: TimerGroup;
  readonly cancellations: Set<() => void>;
  phase: PlaybackPhase;
  draws: number;
  cardDraws: number;
  cancelling: boolean;
}

/** A generation owns all mutable playback state; replacement never retargets retained work. */
export class PlaybackLifetime {
  private current: PlaybackGeneration;
  private transferSequence = 0;
  private binding: BattlePlaybackBind | null = null;
  private bindingRevision = 0;
  private readonly notifications = createNotificationChannel<[]>((error) => {
    logError("Battle playback observer failed", "battle", undefined, undefined, undefined, error);
  });

  constructor(private readonly clock?: TimerClock) {
    this.current = this.createGeneration(0);
  }

  private createGeneration(id: number): PlaybackGeneration {
    return {
      id,
      controller: new AbortController(),
      timers: new TimerGroup(this.clock),
      cancellations: new Set(),
      phase: "ready",
      draws: 0,
      cardDraws: 0,
      cancelling: false,
    };
  }

  readonly subscribe = this.notifications.subscribe;
  readonly isBound = (): boolean => this.binding !== null;
  readonly bind = (binding: BattlePlaybackBind | null): void => {
    const request = ++this.bindingRevision;
    this.clearAutoEndTurn();
    if (request !== this.bindingRevision) return;
    this.binding = binding;
    this.notifications.publish();
  };

  scheduleAutoEndTurn(state?: BattleSnapshot): void {
    if (this.current.phase === "ready") this.binding?.scheduleAutoEndTurn(state);
  }

  clearAutoEndTurn(): void {
    runPlaybackCleanup(() => this.binding?.clearAutoEndTurn());
  }

  get cardPlayInProgress(): boolean {
    return this.current.phase === "playing" || this.current.phase === "opening";
  }

  canAcceptInput(allowOverlappingDraws = false): boolean {
    const { phase, cardDraws } = this.current;
    return (
      phase === "ready" || (allowOverlappingDraws && (phase === "finishing" || (phase === "playing" && cardDraws > 0)))
    );
  }

  canPlayCard(): boolean {
    return this.canAcceptInput(true);
  }
  canEndTurn(): boolean {
    return this.canAcceptInput();
  }

  waitForDelay(id: number, ms: number): Promise<boolean> {
    return this.capture(id).wait(ms);
  }

  private setPhase(generation: PlaybackGeneration, phase: PlaybackPhase): boolean {
    if (this.current !== generation) return false;
    if (generation.phase !== phase) {
      generation.phase = phase;
      this.notifications.publish();
    }
    return this.current === generation && generation.phase === phase && !generation.controller.signal.aborted;
  }

  beginOpening(id: number): boolean {
    const generation = this.current;
    if (!this.isCurrent(id) || generation.phase !== "ready") return false;
    return this.setPhase(generation, "opening");
  }

  beginAction(id: number): boolean {
    const generation = this.current;
    if (!this.isCurrent(id) || (generation.phase !== "ready" && generation.phase !== "playing")) return false;
    this.clearAutoEndTurn();
    if (!this.isCurrent(id) || (generation.phase !== "ready" && generation.phase !== "playing")) return false;
    return this.setPhase(generation, "playing");
  }

  completeAction(id: number): void {
    const generation = this.current;
    if (this.isCurrent(id) && (generation.phase === "playing" || generation.phase === "opening"))
      this.setPhase(generation, "ready");
  }

  get id() {
    return this.current.id;
  }
  get signal() {
    return this.current.controller.signal;
  }
  get pendingDraws() {
    return this.current.draws + this.current.cardDraws;
  }
  get pendingCardDraws() {
    return this.current.cardDraws;
  }
  get pendingTimers() {
    return this.current.timers.size;
  }
  get finishing() {
    return this.current.phase === "finishing";
  }

  isCurrent(id: number): boolean {
    return id === this.current.id && this.current.phase !== "cancelled" && !this.signal.aborted;
  }

  capture(id: number): PlaybackScope {
    const generation = this.current;
    const admitted = this.isCurrent(id);
    const isCurrent = () => admitted && this.current === generation && this.isCurrent(id);
    const schedule = (callback: () => void, ms: number, gameDelay: boolean) => {
      if (!isCurrent()) return () => {};
      const run = () => {
        if (isCurrent()) callback();
      };
      return gameDelay ? generation.timers.setGameTimeout(run, ms) : generation.timers.setTimeout(run, ms);
    };
    const registerCancel = (callback: () => void) => {
      if (isCurrent()) {
        generation.cancellations.add(callback);
        return () => {
          generation.cancellations.delete(callback);
        };
      }
      runPlaybackCleanup(callback);
      return () => {};
    };
    return Object.freeze({
      isCurrent,
      registerCancel,
      wait: (ms: number, signal?: AbortSignal, onCancel?: () => void) =>
        runPlaybackTask(
          registerCancel,
          () => {
            onCancel?.();
            return false;
          },
          (task) => {
            const cancel = () => task.complete(false, onCancel);
            if (signal?.aborted) {
              cancel();
              return;
            }
            signal?.addEventListener("abort", cancel, { once: true });
            task.own(() => signal?.removeEventListener("abort", cancel));
            task.schedule(
              (callback) => schedule(callback, ms, true),
              () => task.complete(isCurrent()),
            );
          },
        ),
      setTimeout: (callback: () => void, ms: number) => schedule(callback, ms, false),
      setGameTimeout: (callback: () => void, ms: number) => schedule(callback, ms, true),
    });
  }

  finish(id: number): boolean {
    const generation = this.current;
    if (!this.isCurrent(id) || this.finishing) return false;
    this.clearAutoEndTurn();
    if (!this.isCurrent(id) || this.finishing) return false;
    return this.setPhase(generation, "finishing");
  }

  registerCancel(callback: () => void): () => void {
    return this.capture(this.id).registerCancel(callback);
  }

  cancelTransfers(): void {
    const generation = this.current;
    const callbacks = [...generation.cancellations];
    generation.cancellations.clear();
    for (const callback of callbacks) runPlaybackCleanup(callback);
  }

  clearTimers(id: number): void {
    if (this.isCurrent(id)) this.current.timers.clearAll();
  }

  cancel(): void {
    const generation = this.current;
    if (generation.cancelling || generation.phase === "cancelled") return;
    generation.cancelling = true;
    generation.phase = "cancelled";
    try {
      generation.draws = 0;
      generation.cardDraws = 0;
      generation.controller.abort();
      runPlaybackCleanup(() => generation.timers.clearAll());
      this.cancelTransfers();
      this.clearAutoEndTurn();
    } finally {
      generation.cancelling = false;
    }
    this.notifications.publish();
  }

  activate(): void {
    if (this.current.phase === "cancelled") this.restart();
  }

  restart(): void {
    const previous = this.current;
    if (previous.cancelling) return;
    this.cancel();
    if (this.current !== previous) return;
    this.current = this.createGeneration(previous.id + 1);
    this.notifications.publish();
  }

  beginDraw(id: number, kind: "draw" | "card" = "draw"): () => void {
    if (!this.isCurrent(id)) return () => {};
    const generation = this.current;
    if (kind === "card") generation.cardDraws++;
    else generation.draws++;
    let settled = false;
    return () => {
      if (settled || !this.isCurrent(id)) return;
      settled = true;
      if (kind === "card") generation.cardDraws--;
      else generation.draws--;
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
