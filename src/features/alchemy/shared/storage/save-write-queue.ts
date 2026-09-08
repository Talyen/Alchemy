import type { SaveData } from "./types";
import { logStorageFailure } from "./save-logging";

export type SaveWriteOutcome = "saved" | "failed" | "skipped";

interface PendingSave {
  data: SaveData;
  generation: number;
  completion: Promise<SaveWriteOutcome>;
  resolve: (outcome: SaveWriteOutcome) => void;
}

export class SaveWriteQueue {
  private chain: Promise<void> = Promise.resolve();
  private coalesced: PendingSave | null = null;
  private pendingClears = 0;
  private runnerActive = false;
  private writesDisabled = false;
  private writeGeneration = 0;
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

  enqueue(data: SaveData, write: (data: SaveData) => Promise<SaveWriteOutcome>): Promise<SaveWriteOutcome> {
    if (this.writesDisabled || this.isClearPending) {
      this.discardPending();
      return Promise.resolve("skipped");
    }
    if (this.coalesced && this.coalesced.generation === this.writeGeneration) {
      this.coalesced.data = data;
      return this.coalesced.completion;
    }
    this.discardPending();
    let resolve!: PendingSave["resolve"];
    const completion = new Promise<SaveWriteOutcome>((settle) => {
      resolve = settle;
    });
    this.coalesced = { data, generation: this.writeGeneration, completion, resolve };
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
    this.writeGeneration++;
    this.cancellationListeners.clear();
  }

  private async runPending(
    pending: PendingSave,
    write: (data: SaveData) => Promise<SaveWriteOutcome>,
  ): Promise<SaveWriteOutcome> {
    if (this.writesDisabled || this.isClearPending || pending.generation !== this.writeGeneration) return "skipped";
    try {
      const outcome = await write(pending.data);
      return pending.generation === this.writeGeneration ? outcome : "skipped";
    } catch (error) {
      logStorageFailure("Save data could not be written", error);
      return "failed";
    }
  }

  private cancelPendingWrites(): void {
    this.writeGeneration++;
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
