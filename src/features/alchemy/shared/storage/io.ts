import { SAVE_KEY } from "@/lib/game-constants";
import { createPlatformSaveBackend, type SaveBackend } from "@/lib/platform-save-backend";

import type { SaveData, UnstampedSaveData } from "./types";
import { evaluateSaveCandidates, type SaveLoadState } from "./save-candidates";
import { createDefaultSaveData } from "./defaults";
import { setWritesDisabled, sharedSaveQueue, type SaveWriteOutcome } from "./save-write-queue";
import { logStorageFailure } from "@/lib/storage-logging";
import { isClientContext } from "@/lib/storage-environment";

let saveBackend: SaveBackend = createPlatformSaveBackend();
let backendConfigured = false;

export function configureSaveBackend(backend: SaveBackend): void {
  saveBackend = backend;
  backendConfigured = true;
}

async function collectSaveCandidates(): Promise<string[]> {
  const result = await saveBackend.readCandidates(SAVE_KEY);
  if (result.ok) return result.candidates;
  throw result.error;
}

function applySaveWritePolicy(result: SaveLoadState): SaveLoadState {
  setWritesDisabled(
    result.status.kind === "unsupported-newer-schema" || result.status.kind === "unsupported-newer-content",
  );
  return result;
}

export async function loadAlchemySaveState(): Promise<SaveLoadState> {
  if (!backendConfigured && !isClientContext()) {
    return applySaveWritePolicy({ data: createDefaultSaveData(), status: { kind: "ok" } });
  }

  let candidates: string[];
  try {
    candidates = await collectSaveCandidates();
  } catch (error) {
    logStorageFailure("Save candidates could not be read, falling back to defaults", error);
    return applySaveWritePolicy({ data: createDefaultSaveData(), status: { kind: "corrupt" } });
  }

  if (candidates.length === 0) {
    return applySaveWritePolicy({ data: createDefaultSaveData(), status: { kind: "ok" } });
  }

  return applySaveWritePolicy(evaluateSaveCandidates(candidates));
}

export async function resetStorageIoForTests(): Promise<void> {
  await sharedSaveQueue.reset();
  saveBackend = createPlatformSaveBackend();
  backendConfigured = false;
}

function trySerializeSaveSnapshot(data: UnstampedSaveData, context: "" | " during page exit"): string | null {
  try {
    return serializeSaveSnapshot(data);
  } catch (error) {
    logStorageFailure(`Save data could not be serialized${context}`, error);
    return null;
  }
}

async function writeSaveSnapshot(data: UnstampedSaveData): Promise<SaveWriteOutcome> {
  const serialized = trySerializeSaveSnapshot(data, "");
  if (serialized === null) return "failed";
  return writeSerializedSnapshot(serialized);
}

async function writeSerializedSnapshot(serialized: string): Promise<SaveWriteOutcome> {
  try {
    const result = await saveBackend.write(SAVE_KEY, serialized);
    if (result.ok) return "saved";
    logStorageFailure("Save data could not be written", result.error);
  } catch (error) {
    logStorageFailure("Save data could not be written", error);
  }
  return "failed";
}

// Exported for tests: each physical write stamps its own `lastSavedAt`, so
// the sync exit write and a trailing queued write for the same snapshot can
// carry different timestamps by design. Pass an explicit `now` to pin that.
export function serializeSaveSnapshot(data: UnstampedSaveData, now: number = Date.now()): string {
  const payload: SaveData = { ...data, lastSavedAt: now };
  return JSON.stringify(payload);
}

export async function saveAlchemySaveData(data: UnstampedSaveData): Promise<SaveWriteOutcome> {
  if (!backendConfigured && !isClientContext()) return "skipped";
  return await sharedSaveQueue.enqueue(data, writeSaveSnapshot);
}

/**
 * Exit flush: the synchronous write uses one pre-serialized payload; when the
 * queue is busy, a trailing queued write re-serializes the same snapshot so it
 * stamps its own fresh lastSavedAt. The sync write and the idle check below
 * run without an interleaving await, so the check-and-enqueue is atomic on the
 * event loop: the trailing enqueue supersedes queued stale snapshots so an
 * in-flight async write cannot land after the exit snapshot.
 */
async function flushSerializedExitSave(data: UnstampedSaveData, serialized: string): Promise<SaveWriteOutcome> {
  let syncResult;
  try {
    syncResult = saveBackend.writeSync(SAVE_KEY, serialized);
  } catch (error) {
    logStorageFailure("Save data could not be written during page exit", error);
    return "failed";
  }
  if (syncResult === null) return await sharedSaveQueue.enqueue(data, writeSaveSnapshot);
  if (!syncResult.ok) {
    logStorageFailure("Save data could not be written during page exit", syncResult.error);
    return "failed";
  }
  if (sharedSaveQueue.isIdle) return "saved";
  return await sharedSaveQueue.enqueue(data, writeSaveSnapshot);
}

export async function saveAlchemySaveDataForExit(data: UnstampedSaveData): Promise<SaveWriteOutcome> {
  if (
    (!backendConfigured && !isClientContext()) ||
    sharedSaveQueue.areWritesDisabled() ||
    sharedSaveQueue.isClearPending
  ) {
    return "skipped";
  }
  const serialized = trySerializeSaveSnapshot(data, " during page exit");
  if (serialized === null) return "failed";
  return flushSerializedExitSave(data, serialized);
}

export async function clearAlchemySaveData(
  mode: "default" | "localWipe" | "wipeForReload" = "default",
): Promise<boolean> {
  if (!backendConfigured && !isClientContext()) return true;
  const forceLocalWipe = mode !== "default";
  const keepWritesDisabled = mode === "wipeForReload";
  return await sharedSaveQueue.enqueueClear(() => saveBackend.clear(SAVE_KEY, { forceLocalWipe }), {
    keepWritesDisabled,
    onError: (error) => logStorageFailure("Save data could not be cleared", error),
  });
}
