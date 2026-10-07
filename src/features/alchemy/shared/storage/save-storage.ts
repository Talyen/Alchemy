import { SAVE_KEY, SAVE_RECOVERY_KEY } from "@/lib/game-constants";
import { type SaveBackend } from "@/lib/platform-save-backend";

import { IS_DEMO, isEditionRunAvailable } from "@/lib/game-edition";
import { logStorageFailure } from "@/lib/storage-logging";
import { createDefaultSaveData } from "./defaults";
import { prepareDemoProgressImport } from "./demo-progress-import";
import { selectSaveCandidates, type SaveLoadState } from "./save-candidates";
import { SaveWriteQueue, type SaveWriteOutcome } from "./save-write-queue";
import type { SaveData, UnstampedSaveData } from "./types";

export class SaveStorage {
  private readonly queue = new SaveWriteQueue();
  private pendingLoads = 0;
  private writeKey = SAVE_KEY;
  private demoInitialization: Promise<SaveLoadState | null> | null = null;
  private lastSavedAt = 0;

  constructor(
    private backend: SaveBackend,
    private readonly now: () => number = () => Date.now(),
  ) {}

  configureBackend(backend: SaveBackend): void {
    if (!this.queue.isIdle || this.queue.isClearPending || this.pendingLoads > 0) {
      throw new Error("Cannot configure save storage while an operation is pending");
    }
    this.backend = backend;
    this.demoInitialization = null;
    this.writeKey = SAVE_KEY;
  }

  setWritesDisabled(disabled: boolean): void {
    this.queue.setWritesDisabled(disabled);
  }

  routeWritesToRecovery(): void {
    this.writeKey = SAVE_RECOVERY_KEY;
    this.setWritesDisabled(false);
  }

  subscribeCancellation(listener: () => void): () => void {
    return this.queue.subscribeCancellation(listener);
  }

  waitForPendingWrites(): Promise<void> {
    return this.queue.waitForIdle();
  }

  async resetForTests(): Promise<void> {
    await this.queue.reset();
    this.demoInitialization = null;
    this.writeKey = SAVE_KEY;
    this.lastSavedAt = 0;
  }

  async load(): Promise<SaveLoadState> {
    this.pendingLoads++;
    try {
      const read = async (key: string) => {
        try {
          return await this.backend.readCandidates(key);
        } catch (error) {
          return { ok: false as const, error };
        }
      };
      const [primary, recovery] = await Promise.all([read(SAVE_KEY), read(SAVE_RECOVERY_KEY)]);
      if (!primary.ok) logStorageFailure("Main save candidates could not be read", primary.error);
      if (!recovery.ok) logStorageFailure("Recovery save candidates could not be read", recovery.error);
      const primaryCandidates = primary.ok ? primary.candidates : [];
      const recoveryCandidates = recovery.ok ? recovery.candidates : [];
      const selection = selectSaveCandidates(primaryCandidates, recoveryCandidates);
      const useRecovery = !primary.ok || primary.localReadFailed === true || selection.useRecovery;
      let loaded = selection.state;

      if (primaryCandidates.length === 0 && recoveryCandidates.length === 0) {
        const readFailed = !primary.ok && !recovery.ok;
        loaded = { data: createDefaultSaveData(), status: { kind: readFailed ? "unavailable" : "ok" } };
        if (!IS_DEMO && !useRecovery && !readFailed && this.backend.readDemoImportSource) {
          this.demoInitialization ??= this.initializeDemoProgress();
          loaded = (await this.demoInitialization) ?? loaded;
        }
      }
      if (loaded.data.activeRun && !isEditionRunAvailable(loaded.data.activeRun)) loaded.data.activeRun = null;
      this.writeKey = useRecovery ? SAVE_RECOVERY_KEY : SAVE_KEY;
      this.lastSavedAt = Math.max(this.lastSavedAt, loaded.data.lastSavedAt);
      this.setWritesDisabled(false);
      return loaded;
    } finally {
      this.pendingLoads--;
    }
  }

  private async initializeDemoProgress(): Promise<SaveLoadState | null> {
    try {
      const source = await this.backend.readDemoImportSource!();
      const snapshot = prepareDemoProgressImport(source);
      if (snapshot) {
        const outcome = await this.save(snapshot);
        if (outcome !== "saved") return null;
        try {
          await this.backend.completeDemoInitialization?.();
        } catch (error) {
          logStorageFailure("Imported progress was saved but its initialization receipt failed", error);
        }
        return { data: { ...snapshot, lastSavedAt: 0 }, status: { kind: "ok" }, importedDemoProgress: true };
      }
      if (!source.readFailed) await this.backend.completeDemoInitialization?.();
    } catch (error) {
      logStorageFailure("Demo progress initialization failed", error);
    }
    return null;
  }

  private trySerializeSaveSnapshot(data: UnstampedSaveData, context: "" | " during page exit"): string | null {
    try {
      // Slot selection keeps the first candidate on ties. New progress must
      // outrank the loaded save and older writes even if the clock stalls or rewinds.
      const savedAt = Math.max(Math.floor(this.now()), this.lastSavedAt + 1);
      if (!Number.isSafeInteger(savedAt)) throw new Error("Save timestamp exceeds the supported integer range");
      const payload: SaveData = { ...data, lastSavedAt: savedAt };
      const serialized = JSON.stringify(payload);
      this.lastSavedAt = savedAt;
      return serialized;
    } catch (error) {
      logStorageFailure(`Save data could not be serialized${context}`, error);
      return null;
    }
  }

  private async writeSaveSnapshot(data: UnstampedSaveData): Promise<SaveWriteOutcome> {
    const serialized = this.trySerializeSaveSnapshot(data, "");
    if (serialized === null) return "failed";
    return this.writeSerializedSnapshot(serialized);
  }

  private async tryWriteSnapshot(key: string, serialized: string, failureMessage: string): Promise<boolean> {
    try {
      const result = await this.backend.write(key, serialized);
      if (result.ok) return true;
      logStorageFailure(failureMessage, result.error);
    } catch (error) {
      logStorageFailure(failureMessage, error);
    }
    return false;
  }

  private async writeSerializedSnapshot(serialized: string): Promise<SaveWriteOutcome> {
    if (await this.tryWriteSnapshot(this.writeKey, serialized, "Save data could not be written")) return "saved";
    if (
      this.writeKey === SAVE_KEY &&
      (await this.tryWriteSnapshot(SAVE_RECOVERY_KEY, serialized, "Recovery save could not be written"))
    ) {
      this.writeKey = SAVE_RECOVERY_KEY;
      return "saved";
    }
    return "failed";
  }

  // Keep this synchronous: exit flushing checks queue ownership before yielding.
  private tryWriteExitSnapshot(key: string, serialized: string, failureMessage: string): boolean | null {
    try {
      const result = this.backend.writeSync(key, serialized);
      if (result === null) return null;
      if (result.ok) return true;
      logStorageFailure(failureMessage, result.error);
    } catch (error) {
      logStorageFailure(failureMessage, error);
    }
    return false;
  }

  async save(data: UnstampedSaveData): Promise<SaveWriteOutcome> {
    return await this.queue.enqueue(data, (snapshot) => this.writeSaveSnapshot(snapshot));
  }

  /**
   * Exit flush: the synchronous write uses one pre-serialized payload; when the
   * queue is busy, a trailing queued write re-serializes the same snapshot so it
   * stamps its own fresh lastSavedAt. The sync write and the idle check below
   * run without an interleaving await, so the check-and-enqueue is atomic on the
   * event loop: the trailing enqueue supersedes queued stale snapshots so an
   * in-flight async write cannot land after the exit snapshot.
   */
  async saveForExit(data: UnstampedSaveData): Promise<SaveWriteOutcome> {
    if (this.queue.areWritesDisabled() || this.queue.isClearPending) return "skipped";
    const serialized = this.trySerializeSaveSnapshot(data, " during page exit");
    if (serialized === null) return "failed";
    let syncResult = this.tryWriteExitSnapshot(
      this.writeKey,
      serialized,
      "Save data could not be written during page exit",
    );
    if (syncResult === false) {
      if (this.writeKey !== SAVE_KEY) return "failed";
      syncResult = this.tryWriteExitSnapshot(
        SAVE_RECOVERY_KEY,
        serialized,
        "Recovery save could not be written during page exit",
      );
      if (syncResult === false) return "failed";
      this.writeKey = SAVE_RECOVERY_KEY;
    }
    if (syncResult === true && this.queue.isIdle) return "saved";
    return this.save(data);
  }

  async clear(mode: "default" | "localWipe" = "default"): Promise<boolean> {
    const forceLocalWipe = mode !== "default";
    const cleared = await this.queue.enqueueClear(() => this.backend.clear(SAVE_KEY, { forceLocalWipe }), {
      onError: (error) => logStorageFailure("Save data could not be cleared", error),
    });
    if (cleared) {
      this.writeKey = SAVE_KEY;
      this.demoInitialization = Promise.resolve(null);
    }
    return cleared;
  }
}
