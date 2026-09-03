import type { SaveData } from "./types";

let writesDisabledForSession = false;

export function areWritesDisabled(): boolean {
  return writesDisabledForSession;
}

export function setWritesDisabled(disabled: boolean): void {
  writesDisabledForSession = disabled;
}

export class SaveWriteQueue {
  private chain: Promise<void> = Promise.resolve();
  private coalesced: SaveData | null = null;
  private clearPending = false;
  private tasks = 0;

  get hasPendingTasks(): boolean {
    return this.tasks > 0;
  }

  get isClearPending(): boolean {
    return this.clearPending;
  }

  async enqueue(data: SaveData, write: (d: SaveData) => Promise<void>): Promise<void> {
    if (writesDisabledForSession || this.clearPending) {
      this.coalesced = null;
      return;
    }
    this.coalesced = data;
    this.tasks += 1;
    const run = this.chain.then(async () => {
      try {
        while (this.coalesced !== null && !this.clearPending) {
          const snapshot = this.coalesced;
          this.coalesced = null;
          if (writesDisabledForSession) return;
          await write(snapshot);
        }
      } finally {
        this.tasks -= 1;
      }
    });
    this.chain = run.catch(() => {});
    await run;
  }

  queueExitSnapshot(data: SaveData): void {
    if (this.tasks > 0) this.coalesced = data;
  }

  async enqueueClear(
    clear: () => Promise<{ ok: boolean }>,
    options?: { keepWritesDisabled?: boolean | undefined; onError?: (error: unknown) => void },
  ): Promise<boolean> {
    this.clearPending = true;
    this.coalesced = null;
    let cleared = false;
    const run = this.chain.then(async () => {
      try {
        this.coalesced = null;
        const result = await clear();
        if (result.ok) {
          if (!options?.keepWritesDisabled) writesDisabledForSession = false;
          cleared = true;
          return;
        }
        options?.onError?.((result as { error?: unknown }).error);
      } finally {
        this.coalesced = null;
        this.clearPending = false;
      }
    });
    this.chain = run.catch(() => {
      this.coalesced = null;
      this.clearPending = false;
    });
    try {
      await run;
    } catch {
      return false;
    }
    return cleared;
  }

  async reset(): Promise<void> {
    await this.chain.catch(() => {});
    this.chain = Promise.resolve();
    this.coalesced = null;
    this.clearPending = false;
    this.tasks = 0;
  }
}
