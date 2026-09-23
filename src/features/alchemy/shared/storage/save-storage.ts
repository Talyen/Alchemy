import { SAVE_KEY, SAVE_RECOVERY_KEY } from "@/lib/game-constants";
import { type SaveBackend } from "@/lib/platform-save-backend";

import type { SaveData, UnstampedSaveData } from "./types";
import { evaluateSaveCandidates, hasUnsupportedFutureCandidate, type SaveLoadState } from "./save-candidates";
import { createDefaultSaveData } from "./defaults";
import { SaveWriteQueue, type SaveWriteOutcome } from "./save-write-queue";
import { logStorageFailure } from "@/lib/storage-logging";

export class SaveStorage {
  private readonly queue = new SaveWriteQueue();
  private pendingLoads = 0;
  private writeKey = SAVE_KEY;

  constructor(private backend: SaveBackend) {}

  configureBackend(backend: SaveBackend): void {
    if (!this.queue.isIdle || this.queue.isClearPending || this.pendingLoads > 0) {
      throw new Error("Cannot configure save storage while an operation is pending");
    }
    this.backend = backend;
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
    this.writeKey = SAVE_KEY;
  }

  private async collectSaveCandidates(): Promise<{ candidates: string[]; useRecovery: boolean; readFailed: boolean }> {
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
    const primaryIncomplete = !primary.ok || primary.localReadFailed === true;
    const primaryCandidates = primary.ok ? primary.candidates : [];
    const recoveryCandidates = recovery.ok ? recovery.candidates : [];
    const primaryHasFuture = hasUnsupportedFutureCandidate(primaryCandidates);
    const recoveryHasFuture = hasUnsupportedFutureCandidate(recoveryCandidates);
    return {
      candidates: [...primaryCandidates, ...recoveryCandidates],
      useRecovery: primaryIncomplete || primaryHasFuture || (recoveryCandidates.length > 0 && !recoveryHasFuture),
      readFailed: !primary.ok && !recovery.ok,
    };
  }

  private applySaveWritePolicy(result: SaveLoadState, useRecovery: boolean): SaveLoadState {
    this.writeKey = useRecovery ? SAVE_RECOVERY_KEY : SAVE_KEY;
    this.setWritesDisabled(false);
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
    const { candidates, useRecovery, readFailed } = await this.collectSaveCandidates();

    if (candidates.length === 0) {
      return this.applySaveWritePolicy(
        { data: createDefaultSaveData(), status: { kind: readFailed ? "unavailable" : "ok" } },
        useRecovery,
      );
    }

    return this.applySaveWritePolicy(evaluateSaveCandidates(candidates), useRecovery);
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
      const result = await this.backend.write(this.writeKey, serialized);
      if (result.ok) return "saved";
      logStorageFailure("Save data could not be written", result.error);
    } catch (error) {
      logStorageFailure("Save data could not be written", error);
    }
    if (this.writeKey === SAVE_KEY) {
      try {
        const recovery = await this.backend.write(SAVE_RECOVERY_KEY, serialized);
        if (recovery.ok) {
          this.writeKey = SAVE_RECOVERY_KEY;
          return "saved";
        }
        logStorageFailure("Recovery save could not be written", recovery.error);
      } catch (error) {
        logStorageFailure("Recovery save could not be written", error);
      }
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
    let syncResult: ReturnType<SaveBackend["writeSync"]>;
    try {
      syncResult = this.backend.writeSync(this.writeKey, serialized);
    } catch (error) {
      syncResult = { ok: false, error };
    }
    if (syncResult === null) return await this.queue.enqueue(data, (snapshot) => this.writeSaveSnapshot(snapshot));
    if (!syncResult.ok) {
      logStorageFailure("Save data could not be written during page exit", syncResult.error);
      if (this.writeKey === SAVE_KEY) {
        let recovery;
        try {
          recovery = this.backend.writeSync(SAVE_RECOVERY_KEY, serialized);
        } catch (error) {
          logStorageFailure("Recovery save could not be written during page exit", error);
          return "failed";
        }
        if (recovery?.ok) {
          this.writeKey = SAVE_RECOVERY_KEY;
        } else if (recovery === null) {
          this.writeKey = SAVE_RECOVERY_KEY;
          return await this.queue.enqueue(data, (snapshot) => this.writeSaveSnapshot(snapshot));
        } else {
          if (recovery) logStorageFailure("Recovery save could not be written during page exit", recovery.error);
          return "failed";
        }
      } else return "failed";
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

  async clear(mode: "default" | "localWipe" = "default"): Promise<boolean> {
    const forceLocalWipe = mode !== "default";
    const cleared = await this.queue.enqueueClear(() => this.backend.clear(SAVE_KEY, { forceLocalWipe }), {
      onError: (error) => logStorageFailure("Save data could not be cleared", error),
    });
    if (cleared) this.writeKey = SAVE_KEY;
    return cleared;
  }
}

// Exported for tests: each physical write stamps its own `lastSavedAt`, so
// the sync exit write and a trailing queued write for the same snapshot can
// carry different timestamps by design. Pass an explicit `now` to pin that.
export function serializeSaveSnapshot(data: UnstampedSaveData, now: number = Date.now()): string {
  const payload: SaveData = { ...data, lastSavedAt: now };
  return JSON.stringify(payload);
}
