import { createNotificationChannel } from "../stores/session/notification-channel";
import { logStorageFailure } from "@/lib/storage-logging";
import type { SaveWriteOutcome } from "./save-operation-queue";

export type ProgressSaveState =
  | { readonly kind: "idle" }
  | { readonly kind: "saving" | "failed"; readonly revision: number };

/** Runtime acknowledgement only: persisted snapshots retain their existing format. */
export class ProgressCompletion {
  constructor(private readonly isActive: () => boolean = () => true) {}

  private state: ProgressSaveState = Object.freeze({ kind: "idle" });
  private epoch = 0;
  private restoreVersion = 0;
  private acknowledged = -1;
  private checkpointVersion = 0;
  private readonly notifications = createNotificationChannel<[]>(
    (error) => {
      logStorageFailure("Progress save status update failed", error);
    },
    () => this.isActive(),
  );
  private readonly restores = createNotificationChannel<[]>(
    (error) => {
      logStorageFailure("Restore save scheduling update failed", error);
    },
    () => this.isActive(),
  );
  private completions: Array<() => void> = [];
  private readyCompletions: Array<{ epoch: number; run: () => void }> = [];
  private deliveringCompletions = false;
  private preparingCompletions = 0;
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
    if (force) {
      // Settings and explicit checkpoints can change without a gameplay revision.
      // Earlier snapshots cannot cover this newly requested durability boundary.
      this.checkpointVersion++;
      this.acknowledged = Math.min(this.acknowledged, revision - 1);
    }
    if (revision <= this.acknowledged) return;
    this.publish({ kind: "saving", revision });
  }

  token(revision: number) {
    return { epoch: this.epoch, revision, checkpointVersion: this.checkpointVersion };
  }

  complete(token: ReturnType<ProgressCompletion["token"]>, outcome: SaveWriteOutcome) {
    if (token.epoch !== this.epoch) return "skipped" as const;
    if (token.checkpointVersion !== this.checkpointVersion) return outcome;
    if (outcome === "saved") this.acknowledged = Math.max(this.acknowledged, token.revision);
    if (this.state.kind === "idle") return outcome;
    if (this.acknowledged >= this.state.revision) {
      const callbacks = this.completions;
      this.completions = [];
      // Reserve the acknowledged batch before idle observers can register more
      // feedback. Nested saves append to this same delivery queue.
      this.readyCompletions.push(...callbacks.map((run) => ({ epoch: token.epoch, run })));
      this.preparingCompletions++;
      try {
        this.publish({ kind: "idle" });
      } finally {
        this.preparingCompletions--;
      }
      this.deliverCompletions();
    } else if (token.revision >= this.state.revision) {
      // An unwritten snapshot is never an acknowledgement. Only explicit cancellation
      // can release the gate without showing completion.
      this.publish({ kind: "failed", revision: this.state.revision });
    }
    return outcome;
  }

  afterSaved(run: () => void) {
    if (!this.isActive()) return;
    if (this.state.kind !== "idle") {
      this.completions.push(run);
      return;
    }
    this.readyCompletions.push({ epoch: this.epoch, run });
    this.deliverCompletions();
  }

  retryNow(fallback: () => void) {
    if (this.state.kind !== "failed") return;
    const token = this.token(this.state.revision);
    const isCurrent = () =>
      this.isActive() &&
      token.epoch === this.epoch &&
      token.checkpointVersion === this.checkpointVersion &&
      this.state.kind === "saving" &&
      this.state.revision === token.revision;
    this.publish({ kind: "saving", revision: this.state.revision });
    // Notification can restore, cancel, dispose, or start a newer checkpoint.
    // Its replacement must never be retried under this request's authority.
    if (!isCurrent()) return;
    const runFallback = () => {
      if (!isCurrent()) return;
      try {
        fallback();
      } catch (error) {
        this.complete(token, "failed");
        logStorageFailure("Progress save retry failed", error);
      }
    };
    // Prefer the most recently attached driver, falling back when it detaches.
    // Select after notification, which can itself release a driver.
    let current: { retry: () => void } | undefined;
    for (const owner of this.retryOwners) current = owner;
    if (!current) {
      runFallback();
      return;
    }
    try {
      current.retry();
    } catch (error) {
      logStorageFailure("Progress save retry driver failed", error);
      runFallback();
    }
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
    this.readyCompletions = [];
  }

  private deliverCompletions() {
    if (this.deliveringCompletions || this.preparingCompletions) return;
    this.deliveringCompletions = true;
    try {
      // A ready callback can start a new checkpoint. Keep the remaining
      // acknowledged feedback queued until the current save gate opens again.
      while (this.readyCompletions.length && this.isActive() && this.state.kind === "idle") {
        const completion = this.readyCompletions.shift()!;
        if (completion.epoch !== this.epoch) continue;
        try {
          completion.run();
        } catch (error) {
          logStorageFailure("Saved progress feedback failed", error);
        }
      }
    } finally {
      this.deliveringCompletions = false;
    }
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
