import { createNotificationChannel } from "../stores/notification-channel";
import { logStorageFailure } from "@/lib/storage-logging";
import type { SaveWriteOutcome } from "./save-operation-queue";

export type ProgressSaveState =
  | { readonly kind: "idle" }
  | { readonly kind: "saving" | "failed"; readonly revision: number };

/** Runtime acknowledgement only: persisted snapshots retain their existing format. */
export class ProgressCompletion {
  private state: ProgressSaveState = Object.freeze({ kind: "idle" });
  private epoch = 0;
  private restoreVersion = 0;
  private acknowledged = -1;
  private readonly notifications = createNotificationChannel<[]>((error) => {
    logStorageFailure("Progress save status update failed", error);
  });
  private readonly restores = createNotificationChannel<[]>((error) => {
    logStorageFailure("Restore save scheduling update failed", error);
  });
  private completions: Array<() => void> = [];
  private retryOwners = new Set<{ retry: () => void }>();

  readonly read = (): ProgressSaveState => this.state;
  readonly subscribe = this.notifications.subscribe;
  readonly readRestoreVersion = () => this.restoreVersion;
  readonly subscribeRestore = this.restores.subscribe;

  registerRetryDriver(retry: () => void) {
    // Registration identity belongs to the client; pending acknowledgements
    // belong to the session and survive every client's scheduling lifetime.
    const owner = { retry };
    this.retryOwners.add(owner);
    return () => {
      this.retryOwners.delete(owner);
    };
  }

  get hasRetryDriver() {
    return this.retryOwners.size > 0;
  }

  mark(revision: number, force = false) {
    if (force) this.acknowledged = Math.min(this.acknowledged, revision - 1);
    if (revision <= this.acknowledged) return;
    this.publish({ kind: "saving", revision });
  }

  token(revision: number) {
    return { epoch: this.epoch, revision };
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
    // Prefer the most recently attached driver, falling back when it detaches.
    // Select after notification, which can itself release a driver.
    let current: { retry: () => void } | undefined;
    for (const owner of this.retryOwners) current = owner;
    current?.retry();
  }

  cancel() {
    this.invalidateReceipts();
    this.publish({ kind: "idle" });
  }

  /** Replace a career without briefly unlocking unsaved replacement state. */
  replace(revision?: number) {
    this.invalidateReceipts();
    this.restoreVersion++;
    this.publish(revision === undefined ? { kind: "idle" } : { kind: "saving", revision }, true);
  }

  private invalidateReceipts() {
    this.epoch++;
    this.acknowledged = -1;
    this.completions = [];
  }

  private publish(state: ProgressSaveState, restored = false) {
    const unchanged =
      state.kind === this.state.kind &&
      (state.kind === "idle" || (this.state.kind !== "idle" && state.revision === this.state.revision));
    this.state = Object.freeze(state);
    if (restored) {
      // Invalidate autosave submissions before any status or store observer
      // can schedule a write in the replacement epoch, even if data is equal.
      this.restores.publish();
    }
    if (unchanged) return;
    this.notifications.publish();
  }
}
