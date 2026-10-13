import type { UnstampedSaveData } from "./types";
import { logStorageFailure } from "@/lib/storage-logging";

export type SaveWriteOutcome = "saved" | "failed" | "skipped" | "superseded";

interface PendingSave {
  data: UnstampedSaveData;
  storageEpoch: number;
  write: (data: UnstampedSaveData) => Promise<SaveWriteOutcome>;
  resolve: (outcome: SaveWriteOutcome) => void;
}

interface SaveBatch {
  pending: PendingSave | null;
}

export class SaveOperationQueue {
  // Loads are barriers: writes may coalesce only on the same side of a load.
  // The epoch invalidates submitted writes. Cancellation also tells autosave
  // to discard dirty revisions it has not submitted, preventing deleted-save revival.
  private chain: Promise<void> = Promise.resolve();
  private coalesced: SaveBatch | null = null;
  private pendingWrites = new Set<SaveBatch>();
  private pendingOperations = 0;
  private pendingLoads = 0;
  // Counter (not boolean): overlapping clears must each hold the write gate
  // until all finish, otherwise a write could slip between two clears.
  private pendingClears = 0;
  private writesDisabled = false;
  private storageEpoch = 0;
  private cancellationListeners = new Set<() => void>();

  get isIdle(): boolean {
    return this.pendingOperations === 0;
  }

  get isLoadPending(): boolean {
    return this.pendingLoads > 0;
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
    // A replaced payload was never written. Sharing the replacement's success
    // would let its predecessor acknowledge progress absent from the disk.
    let resolve!: PendingSave["resolve"];
    const completion = new Promise<SaveWriteOutcome>((settle) => {
      resolve = settle;
    });
    const pending = { data: owned, storageEpoch: this.storageEpoch, write, resolve };
    if (this.coalesced) {
      this.coalesced.pending?.resolve("superseded");
      this.coalesced.pending = pending;
    } else {
      const batch: SaveBatch = { pending };
      this.coalesced = batch;
      this.pendingWrites.add(batch);
      void this.enqueueOperation(async () => {
        if (this.coalesced === batch) this.coalesced = null;
        this.pendingWrites.delete(batch);
        const pending = batch.pending;
        batch.pending = null;
        return pending ? { pending, outcome: await this.runPending(pending) } : null;
      }).then((result) => {
        if (result) {
          const { pending, outcome } = result;
          pending.resolve(pending.storageEpoch === this.storageEpoch ? outcome : "skipped");
        }
      });
    }
    return completion;
  }

  /** The callback owns all load work, including any initialization write. */
  enqueueLoad<T>(load: () => Promise<T>): Promise<T> {
    this.pendingLoads++;
    this.coalesced = null;
    return this.enqueueOperation(async () => {
      try {
        return await load();
      } finally {
        this.pendingLoads--;
      }
    });
  }

  async enqueueClear(
    clear: () => Promise<{ ok: boolean; error?: unknown }>,
    options?: { onError?: (error: unknown) => void },
  ): Promise<boolean> {
    this.pendingClears++;
    const operation = this.enqueueOperation(async () => {
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
    // Reserve the clear's place before cancellation listeners can submit loads.
    this.cancelPendingWrites();
    return operation;
  }

  /** Drain submitted storage work without creating a final save. */
  async waitForIdle(): Promise<void> {
    while (!this.isIdle) await this.chain;
  }

  async reset(): Promise<void> {
    await this.waitForIdle();
    this.chain = Promise.resolve();
    this.writesDisabled = false;
    this.storageEpoch++;
    this.cancellationListeners.clear();
  }

  private enqueueOperation<T>(execute: () => Promise<T>): Promise<T> {
    this.pendingOperations++;
    const operation = this.chain.then(execute);
    const finished = () => {
      this.pendingOperations--;
    };
    // A failed read must reject its caller without poisoning subsequent work.
    this.chain = operation.then(finished, finished);
    return operation;
  }

  private async runPending(pending: PendingSave): Promise<SaveWriteOutcome> {
    if (this.writesDisabled || this.isClearPending || pending.storageEpoch !== this.storageEpoch) return "skipped";
    try {
      const outcome = await pending.write(pending.data);
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
    for (const batch of this.pendingWrites) {
      batch.pending?.resolve("skipped");
      batch.pending = null;
    }
    this.coalesced = null;
    for (const listener of this.cancellationListeners) {
      try {
        listener();
      } catch (error) {
        // A subscriber must not strand the clear gate or suppress other cancellations.
        logStorageFailure("Save cancellation listener threw", error);
      }
    }
  }
}
