import type { SaveData } from "./types";

export type SaveWriteOutcome = "saved" | "failed" | "skipped";

let writesDisabledForSession = false;
let writeGeneration = 0;
const cancellationListeners = new Set<() => void>();

export function subscribeSaveCancellation(listener: () => void): () => void {
  cancellationListeners.add(listener);
  return () => {
    cancellationListeners.delete(listener);
  };
}

function cancelSaveRequests(): void {
  writeGeneration++;
  for (const listener of cancellationListeners) listener();
}

export function areWritesDisabled(): boolean {
  return writesDisabledForSession;
}

export function setWritesDisabled(disabled: boolean): void {
  writesDisabledForSession = disabled;
  if (disabled) cancelSaveRequests();
}

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

  get isIdle(): boolean {
    return !this.runnerActive && this.coalesced === null;
  }

  get isClearPending(): boolean {
    return this.pendingClears > 0;
  }

  enqueue(data: SaveData, write: (data: SaveData) => Promise<SaveWriteOutcome>): Promise<SaveWriteOutcome> {
    if (writesDisabledForSession || this.isClearPending) return Promise.resolve("skipped");
    if (this.coalesced?.generation !== writeGeneration) this.discardPending();
    if (this.coalesced) {
      this.coalesced.data = data;
      return this.coalesced.completion;
    }
    let resolve!: PendingSave["resolve"];
    const completion = new Promise<SaveWriteOutcome>((settle) => {
      resolve = settle;
    });
    this.coalesced = { data, generation: writeGeneration, completion, resolve };
    if (!this.runnerActive) {
      this.runnerActive = true;
      this.chain = this.chain.then(async () => {
        try {
          while (this.coalesced) {
            const pending = this.coalesced;
            this.coalesced = null;
            let outcome: SaveWriteOutcome = "skipped";
            if (!writesDisabledForSession && !this.isClearPending && pending.generation === writeGeneration) {
              try {
                outcome = await write(pending.data);
              } catch {
                outcome = "failed";
              }
            }
            pending.resolve(pending.generation === writeGeneration ? outcome : "skipped");
          }
        } finally {
          this.runnerActive = false;
        }
      });
    }
    return completion;
  }

  private discardPending(): void {
    this.coalesced?.resolve("skipped");
    this.coalesced = null;
  }

  async enqueueClear(
    clear: () => Promise<{ ok: boolean; error?: unknown }>,
    options?: { keepWritesDisabled?: boolean | undefined; onError?: (error: unknown) => void },
  ): Promise<boolean> {
    this.pendingClears++;
    cancelSaveRequests();
    this.discardPending();
    const run = this.chain.then(async () => {
      try {
        const result = await clear();
        if (!result.ok) {
          options?.onError?.(result.error);
          return false;
        }
        if (!options?.keepWritesDisabled) writesDisabledForSession = false;
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
  }
}
