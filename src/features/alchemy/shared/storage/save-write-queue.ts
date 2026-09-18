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
  // Async serialization chain: writes and clears run one at a time. The
  // coalesced slot holds the latest pending write; the runner drains it in a
  // loop so overlapping enqueues collapse to two physical writes at most.
  // storageEpoch invalidates stale writes on clear/protection/reset; it is
  // distinct from the autosave schedulerEpoch, which guards hook-lifetime
  // revision counters (see autosave-scheduler.ts). Both are required: the
  // "skipped" completion repairs a scheduler that already submitted, but a
  // clear with no pending write still needs the cancellation broadcast to
  // drop a debounced-but-unsubmitted dirty revision before it resurrects a
  // deleted save. A clear also restarts the scheduler's max-wait window by
  // design (old dirt is gone); failure retries instead preserve it.
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
    // The queue owns its snapshot: clone synchronously on entry so a caller
    // mutating after enqueue cannot corrupt the pending write (the runner
    // drains in a later microtask, so deferring the clone to dequeue would
    // capture same-task caller mutations). Coalescing swaps in the latest
    // clone. Payloads are JSON-serializable by construction; a
    // type-violating payload degrades to "failed" instead of throwing into
    // terminal-flush callers that do not expect a synchronous throw.
    let owned: UnstampedSaveData;
    try {
      owned = structuredClone(data);
    } catch (error) {
      logStorageFailure("Save snapshot could not be cloned", error);
      return Promise.resolve("failed");
    }
    // A non-null coalesced slot always carries the current epoch:
    // cancelPendingWrites bumps the epoch and clears the slot together, so no
    // stale-epoch branch is needed here (staleness is still checked at drain).
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
    options?: { keepWritesDisabled?: boolean | undefined; onError?: (error: unknown) => void },
  ): Promise<boolean> {
    this.pendingClears++;
    this.cancelPendingWrites();
    const run = this.chain.then(async () => {
      try {
        const result = await clear();
        if (!result.ok) {
          options?.onError?.(result.error);
          return false;
        }
        if (!options?.keepWritesDisabled) this.writesDisabled = false;
        return true;
      } catch (error) {
        options?.onError?.(error);
        return false;
      } finally {
        this.pendingClears--;
      }
    });
    this.chain = run.then(() => {});
    return run;
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
      // (io.ts writeSaveSnapshot) catches internally and resolves "failed".
      // Kept distinct from io.ts "Save data could not be written" so failure
      // aggregation does not double-count one failed write.
      logStorageFailure("Queued save write threw", error);
      return "failed";
    }
  }

  private cancelPendingWrites(): void {
    this.storageEpoch++;
    this.discardPending();
    for (const listener of this.cancellationListeners) listener();
  }

  private discardPending(): void {
    this.coalesced?.resolve("skipped");
    this.coalesced = null;
  }
}

export const sharedSaveQueue = new SaveWriteQueue();

export function subscribeSaveCancellation(listener: () => void): () => void {
  return sharedSaveQueue.subscribeCancellation(listener);
}

export function setWritesDisabled(disabled: boolean): void {
  sharedSaveQueue.setWritesDisabled(disabled);
}
