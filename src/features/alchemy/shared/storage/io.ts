import { SAVE_KEY } from "@/lib/game-constants";
import { createPlatformSaveBackend, type SaveBackend } from "@/lib/platform-save-backend";

import type { SaveData } from "./types";
import { evaluateSaveCandidates, type SaveLoadState } from "./save-candidates";
import { createDefaultSaveData } from "./defaults";
import { setWritesDisabled, sharedSaveQueue, type SaveWriteOutcome } from "./save-write-queue";
import { logStorageFailure } from "./save-logging";

let saveBackend: SaveBackend = createPlatformSaveBackend();

export function configureSaveBackend(backend: SaveBackend): void {
  saveBackend = backend;
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
  if (typeof window === "undefined") {
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
}

function trySerializeSaveSnapshot(data: SaveData, context: string): string | null {
  try {
    return serializeSaveSnapshot(data);
  } catch (error) {
    logStorageFailure(`Save data could not be serialized${context}`, error);
    return null;
  }
}

async function writeSaveSnapshot(data: SaveData): Promise<SaveWriteOutcome> {
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

function serializeSaveSnapshot(data: SaveData, now: number = Date.now()): string {
  const payload: SaveData = { ...data, lastSavedAt: now };
  return JSON.stringify(payload);
}

export async function saveAlchemySaveData(data: SaveData): Promise<SaveWriteOutcome> {
  if (typeof window === "undefined") return "skipped";
  return await sharedSaveQueue.enqueue(data, writeSaveSnapshot);
}

export async function saveAlchemySaveDataForExit(data: SaveData): Promise<SaveWriteOutcome> {
  if (typeof window === "undefined" || sharedSaveQueue.areWritesDisabled() || sharedSaveQueue.isClearPending) {
    return "skipped";
  }
  const serialized = trySerializeSaveSnapshot(data, " during page exit");
  if (serialized === null) return "failed";
  try {
    const result = saveBackend.writeSync(SAVE_KEY, serialized);
    if (result === null) return await sharedSaveQueue.enqueue(data, writeSaveSnapshot);
    if (!result.ok) {
      logStorageFailure("Save data could not be written during page exit", result.error);
      return "failed";
    }
    if (sharedSaveQueue.isIdle) return "saved";
    return await sharedSaveQueue.enqueue(data, writeSaveSnapshot);
  } catch (error) {
    logStorageFailure("Save data could not be written during page exit", error);
    return "failed";
  }
}

export async function clearAlchemySaveData(options?: {
  keepWritesDisabled?: boolean;
  forceLocalWipe?: boolean;
}): Promise<boolean> {
  if (typeof window === "undefined") return true;
  const forceLocalWipe = options?.forceLocalWipe ?? sharedSaveQueue.areWritesDisabled();
  return await sharedSaveQueue.enqueueClear(() => saveBackend.clear(SAVE_KEY, { forceLocalWipe }), {
    keepWritesDisabled: options?.keepWritesDisabled,
    onError: (error) => logStorageFailure("Save data could not be cleared", error),
  });
}
