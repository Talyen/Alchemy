import { logStorageFailure } from "./storage-logging";

/** Serializes both slots and keeps only the newest queued payload per slot. */
export class CloudSaveMirror {
  private pending = new Map<string, () => Promise<boolean | undefined>>();
  private running: Promise<void> | null = null;
  private clears = 0;
  private suspended = new Map<string, () => Promise<boolean | undefined>>();
  private clearSucceeded = false;

  enqueue(slot: string, write: () => Promise<boolean | undefined>) {
    if (this.clears) return;
    this.pending.set(slot, write);
    this.start();
  }

  /** `remove` must reject on failure so suspended uploads can be retried. */
  async clear<T>(remove: () => Promise<T>): Promise<T> {
    if (this.clears === 0) {
      this.suspended = this.pending;
      this.pending = new Map();
      this.clearSucceeded = false;
    }
    this.clears++;
    try {
      await this.running;
      const result = await remove();
      this.clearSucceeded = true;
      return result;
    } finally {
      this.clears--;
      if (this.clears === 0) {
        if (!this.clearSucceeded) this.pending = this.suspended;
        this.suspended = new Map();
        this.start();
      }
    }
  }

  private start() {
    if (this.running || this.clears || !this.pending.size) return;
    // Publish the actual completion before invoking a write: adapters may
    // synchronously enqueue another slot or request a clear from that callback.
    let begin!: () => void;
    const draining = new Promise<void>((resolve, reject) => {
      begin = () => {
        void this.drain().then(resolve, reject);
      };
    });
    this.running = draining.finally(() => {
      this.running = null;
      this.start();
    });
    begin();
  }

  private async drain() {
    while (this.pending.size) {
      const [slot, write] = this.pending.entries().next().value!;
      this.pending.delete(slot);
      try {
        if (!(await write())) logStorageFailure("Steam Cloud write failed, save may not sync");
      } catch (error) {
        logStorageFailure("Steam Cloud write failed, save may not sync", error);
      }
    }
  }
}
