import { logStorageFailure } from "./storage-logging";

/** Serializes both slots and keeps only the newest queued payload per slot. */
export class CloudSaveMirror {
  private pending = new Map<string, () => Promise<boolean | undefined>>();
  private running: Promise<void> | null = null;
  private clears = 0;

  enqueue(slot: string, write: () => Promise<boolean | undefined>) {
    if (this.clears) return;
    this.pending.set(slot, write);
    this.start();
  }

  async clear<T>(remove: () => Promise<T>): Promise<T> {
    this.clears++;
    this.pending.clear();
    try {
      await this.running;
      return await remove();
    } finally {
      this.clears--;
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
