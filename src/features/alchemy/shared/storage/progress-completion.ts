import { logStorageFailure } from "@/lib/storage-logging";
import type { SaveWriteOutcome } from "./save-write-queue";

export type ProgressSaveState =
  | { readonly kind: "idle" }
  | { readonly kind: "saving" | "failed"; readonly revision: number };

/** Runtime acknowledgement only: persisted snapshots retain their existing format. */
export class ProgressCompletion {
  private state: ProgressSaveState = { kind: "idle" };
  private epoch = 0;
  private acknowledged = -1;
  private snapshots = new WeakMap<object, { epoch: number; revision: number; contents: string }>();
  private listeners = new Set<() => void>();
  private completions: Array<() => void> = [];
  private retry: (() => void) | null = null;

  readonly read = (): ProgressSaveState => this.state;
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  activate(retry: () => void) {
    this.retry = retry;
    return () => {
      this.retry = null;
      this.cancel();
    };
  }

  get active() {
    return this.retry !== null;
  }

  mark(revision: number, force = false) {
    if (force) this.acknowledged = Math.min(this.acknowledged, revision - 1);
    if (revision <= this.acknowledged) return;
    this.publish({ kind: "saving", revision });
  }

  token(revision: number) {
    return { epoch: this.epoch, revision };
  }

  captureSnapshot<T extends object>(snapshot: T, revision: number): T {
    this.snapshots.set(snapshot, { ...this.token(revision), contents: JSON.stringify(snapshot) });
    return snapshot;
  }

  /** Validate at submission, before callers can mutate the object during IO. */
  prepareSnapshotWrite(snapshot: object): (outcome: SaveWriteOutcome) => SaveWriteOutcome {
    const receipt = this.snapshots.get(snapshot);
    let token: { epoch: number; revision: number } | undefined;
    try {
      if (receipt && receipt.contents === JSON.stringify(snapshot)) token = receipt;
    } catch {
      // Invalid external payloads still follow the storage failure path.
    }
    return (outcome) => (token ? this.complete(token, outcome) : outcome);
  }

  complete(token: { epoch: number; revision: number }, outcome: SaveWriteOutcome) {
    if (token.epoch !== this.epoch) return "skipped" as const;
    if (outcome === "saved") this.acknowledged = Math.max(this.acknowledged, token.revision);
    if (this.state.kind === "idle") return outcome;
    if (this.acknowledged >= this.state.revision) {
      const callbacks = this.completions;
      this.completions = [];
      this.publish({ kind: "idle" });
      for (const callback of callbacks) {
        if (token.epoch !== this.epoch) break;
        try {
          callback();
        } catch (error) {
          logStorageFailure("Saved progress feedback failed", error);
        }
      }
    } else if (token.revision >= this.state.revision) {
      // An unwritten snapshot is never an acknowledgement. Only explicit cancellation
      // can release the gate without showing completion.
      this.publish({ kind: "failed", revision: this.state.revision });
    }
    return outcome;
  }

  afterSaved(run: () => void) {
    if (this.state.kind === "idle") run();
    else this.completions.push(run);
  }

  retryNow() {
    if (this.state.kind !== "failed") return;
    this.publish({ kind: "saving", revision: this.state.revision });
    this.retry?.();
  }

  cancel() {
    this.epoch++;
    this.acknowledged = -1;
    this.completions = [];
    this.publish({ kind: "idle" });
  }

  private publish(state: ProgressSaveState) {
    if (
      state.kind === this.state.kind &&
      (state.kind === "idle" || (this.state.kind !== "idle" && state.revision === this.state.revision))
    )
      return;
    this.state = state;
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        logStorageFailure("Progress save status update failed", error);
      }
    }
  }
}
