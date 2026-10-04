import type { UnstampedSaveData } from "./types";
import { logStorageFailure } from "@/lib/storage-logging";

export type SaveWriteOutcome = "saved" | "failed" | "skipped";

interface PendingSave {
  data: UnstampedSaveData;
  storageEpoch: number;
  completion: Promise<SaveWriteOutcome>;
  resolve: (outcome: SaveWriteOutcome) => void;
}

export class SaveWriteQueue {
  // Serialize writes and clears; keep only the newest pending snapshot.
  // The epoch invalidates submitted writes. Cancellation also tells autosave
  // to discard dirty revisions it has not submitted, preventing deleted-save revival.
  private chain: Promise<void> = Promise.resolve();
  private coalesced: PendingSave | null = null;
  // Counter (not boolean): overlapping clears must each hold the write gate
  // until all finish, otherwise a write could slip between two clears.
  private pendingClears = 0;
  private runnerActive = false;
  private writesDisabled = false;
  private storageEpoch = 0;
  private cancellationListeners = new Set<() => void>();

  get isIdle(): boolean {
    return !this.runnerActive && this.coalesced === null;
  }

  get isClearPending(): boolean {
    return this.pendingClears > 0;
  }

  areWritesDisabled(): boolean {
    return this.writesDisabled;
  }

  setWritesDisabled(disabled: boolean): void {
    this.writesDisabled = disabled;
    if (disabled) this.cancelPendingWrites();
  }

  subscribeCancellation(listener: () => void): () => void {
    this.cancellationListeners.add(listener);
    return () => {
      this.cancellationListeners.delete(listener);
    };
  }

  enqueue(
    data: UnstampedSaveData,
    write: (data: UnstampedSaveData) => Promise<SaveWriteOutcome>,
  ): Promise<SaveWriteOutcome> {
    if (this.writesDisabled || this.isClearPending) {
      this.discardPending();
      return Promise.resolve("skipped");
    }
    // Clone before the runner's microtask: callers may mutate immediately after
    // enqueue. Invalid snapshots fail asynchronously like ordinary write failures.
    let owned: UnstampedSaveData;
    try {
      owned = structuredClone(data);
    } catch (error) {
      logStorageFailure("Save snapshot could not be cloned", error);
      return Promise.resolve("failed");
    }
    if (this.coalesced) {
      this.coalesced.data = owned;
      return this.coalesced.completion;
    }
    let resolve!: PendingSave["resolve"];
    const completion = new Promise<SaveWriteOutcome>((settle) => {
      resolve = settle;
    });
    this.coalesced = { data: owned, storageEpoch: this.storageEpoch, completion, resolve };
    if (!this.runnerActive) {
      this.runnerActive = true;
      this.chain = this.chain.then(async () => {
        try {
          while (this.coalesced) {
            const pending = this.coalesced;
            this.coalesced = null;
            pending.resolve(await this.runPending(pending, write));
          }
        } finally {
          this.runnerActive = false;
        }
      });
    }
    return completion;
  }

  async enqueueClear(
    clear: () => Promise<{ ok: boolean; error?: unknown }>,
    options?: { onError?: (error: unknown) => void },
  ): Promise<boolean> {
    this.pendingClears++;
    this.cancelPendingWrites();
    const run = this.chain.then(async () => {
      try {
        const result = await clear();
        if (!result.ok) throw result.error;
        this.writesDisabled = false;
        return true;
      } catch (error) {
        try {
          options?.onError?.(error);
        } catch (notificationError) {
          // Reporting must not reject the serialization chain and block later saves.
          logStorageFailure("Save clear error handler threw", notificationError);
        }
        return false;
      } finally {
        this.pendingClears--;
      }
    });
    this.chain = run.then(() => {});
    return run;
  }

  /** Await already-enqueued writes without creating a final save (deliberate checkpoints). */
  async waitForIdle(): Promise<void> {
    while (!this.isIdle) await this.chain;
  }

  async reset(): Promise<void> {
    await this.chain;
    this.chain = Promise.resolve();
    this.discardPending();
    this.pendingClears = 0;
    this.runnerActive = false;
    this.writesDisabled = false;
    this.storageEpoch++;
    this.cancellationListeners.clear();
  }

  private async runPending(
    pending: PendingSave,
    write: (data: UnstampedSaveData) => Promise<SaveWriteOutcome>,
  ): Promise<SaveWriteOutcome> {
    if (this.writesDisabled || this.isClearPending || pending.storageEpoch !== this.storageEpoch) return "skipped";
    try {
      const outcome = await write(pending.data);
      return pending.storageEpoch === this.storageEpoch ? outcome : "skipped";
    } catch (error) {
      // Only fires for injected/unexpected throws: the real write path
      // (save-storage.ts writeSaveSnapshot) catches internally and resolves "failed".
      // Kept distinct from save-storage.ts "Save data could not be written" so failure
      // aggregation does not double-count one failed write.
      logStorageFailure("Queued save write threw", error);
      return "failed";
    }
  }

  private cancelPendingWrites(): void {
    this.storageEpoch++;
    this.discardPending();
    for (const listener of this.cancellationListeners) {
      try {
        listener();
      } catch (error) {
        // A subscriber must not strand the clear gate or suppress other cancellations.
        logStorageFailure("Save cancellation listener threw", error);
      }
    }
  }

  private discardPending(): void {
    this.coalesced?.resolve("skipped");
    this.coalesced = null;
  }
}
