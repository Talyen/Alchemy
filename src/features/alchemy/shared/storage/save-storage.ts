import { SAVE_KEY } from "@/lib/game-constants";
import { type SaveBackend } from "@/lib/platform-save-backend";

import type { SaveData, UnstampedSaveData } from "./types";
import { evaluateSaveCandidates, type SaveLoadState } from "./save-candidates";
import { createDefaultSaveData } from "./defaults";
import { SaveWriteQueue, type SaveWriteOutcome } from "./save-write-queue";
import { logStorageFailure } from "@/lib/storage-logging";

export class SaveStorage {
  private readonly queue = new SaveWriteQueue();
  private pendingLoads = 0;

  constructor(private backend: SaveBackend) {}

  configureBackend(backend: SaveBackend): void {
    if (!this.queue.isIdle || this.queue.isClearPending || this.pendingLoads > 0) {
      throw new Error("Cannot configure save storage while an operation is pending");
    }
    this.backend = backend;
  }

  setWritesDisabled(disabled: boolean): void {
    this.queue.setWritesDisabled(disabled);
  }

  subscribeCancellation(listener: () => void): () => void {
    return this.queue.subscribeCancellation(listener);
  }

  waitForPendingWrites(): Promise<void> {
    return this.queue.waitForIdle();
  }

  async resetForTests(): Promise<void> {
    await this.queue.reset();
  }

  private async collectSaveCandidates(): Promise<string[]> {
    const result = await this.backend.readCandidates(SAVE_KEY);
    if (result.ok) return result.candidates;
    throw result.error;
  }

  private applySaveWritePolicy(result: SaveLoadState): SaveLoadState {
    this.setWritesDisabled(
      result.status.kind === "unsupported-newer-schema" || result.status.kind === "unsupported-newer-content",
    );
    return result;
  }

  async load(): Promise<SaveLoadState> {
    this.pendingLoads++;
    try {
      return await this.loadState();
    } finally {
      this.pendingLoads--;
    }
  }

  private async loadState(): Promise<SaveLoadState> {
    let candidates: string[];
    try {
      candidates = await this.collectSaveCandidates();
    } catch (error) {
      logStorageFailure("Save candidates could not be read, falling back to defaults", error);
      return this.applySaveWritePolicy({ data: createDefaultSaveData(), status: { kind: "corrupt" } });
    }

    if (candidates.length === 0) {
      return this.applySaveWritePolicy({ data: createDefaultSaveData(), status: { kind: "ok" } });
    }

    return this.applySaveWritePolicy(evaluateSaveCandidates(candidates));
  }

  private trySerializeSaveSnapshot(data: UnstampedSaveData, context: "" | " during page exit"): string | null {
    try {
      return serializeSaveSnapshot(data);
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

  private async writeSerializedSnapshot(serialized: string): Promise<SaveWriteOutcome> {
    try {
      const result = await this.backend.write(SAVE_KEY, serialized);
      if (result.ok) return "saved";
      logStorageFailure("Save data could not be written", result.error);
    } catch (error) {
      logStorageFailure("Save data could not be written", error);
    }
    return "failed";
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
  private async flushSerializedExitSave(data: UnstampedSaveData, serialized: string): Promise<SaveWriteOutcome> {
    let syncResult;
    try {
      syncResult = this.backend.writeSync(SAVE_KEY, serialized);
    } catch (error) {
      logStorageFailure("Save data could not be written during page exit", error);
      return "failed";
    }
    if (syncResult === null) return await this.queue.enqueue(data, (snapshot) => this.writeSaveSnapshot(snapshot));
    if (!syncResult.ok) {
      logStorageFailure("Save data could not be written during page exit", syncResult.error);
      return "failed";
    }
    if (this.queue.isIdle) return "saved";
    return await this.queue.enqueue(data, (snapshot) => this.writeSaveSnapshot(snapshot));
  }

  async saveForExit(data: UnstampedSaveData): Promise<SaveWriteOutcome> {
    if (this.queue.areWritesDisabled() || this.queue.isClearPending) {
      return "skipped";
    }
    const serialized = this.trySerializeSaveSnapshot(data, " during page exit");
    if (serialized === null) return "failed";
    return this.flushSerializedExitSave(data, serialized);
  }

  async clear(mode: "default" | "localWipe" | "wipeForReload" = "default"): Promise<boolean> {
    const forceLocalWipe = mode !== "default";
    const keepWritesDisabled = mode === "wipeForReload";
    return await this.queue.enqueueClear(() => this.backend.clear(SAVE_KEY, { forceLocalWipe }), {
      keepWritesDisabled,
      onError: (error) => logStorageFailure("Save data could not be cleared", error),
    });
  }
}

// Exported for tests: each physical write stamps its own `lastSavedAt`, so
// the sync exit write and a trailing queued write for the same snapshot can
// carry different timestamps by design. Pass an explicit `now` to pin that.
export function serializeSaveSnapshot(data: UnstampedSaveData, now: number = Date.now()): string {
  const payload: SaveData = { ...data, lastSavedAt: now };
  return JSON.stringify(payload);
}
