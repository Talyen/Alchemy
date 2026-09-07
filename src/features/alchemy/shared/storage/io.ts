import { SAVE_KEY } from "@/lib/game-constants";
import { createPlatformSaveBackend, type SaveBackend } from "@/lib/platform-save-backend";

import type { SaveData } from "./types";
import { logError } from "@/lib/error-logger";
import { evaluateSaveCandidates, fallbackSaveData, type SaveLoadState } from "./save-candidates";
import { areWritesDisabled, SaveWriteQueue, setWritesDisabled, type SaveWriteOutcome } from "./save-write-queue";

export { evaluateSaveCandidates, fallbackSaveData } from "./save-candidates";
export { subscribeSaveCancellation } from "./save-write-queue";
export type { SaveWriteOutcome } from "./save-write-queue";
export type { SaveLoadState } from "./save-candidates";

let saveBackend: SaveBackend = createPlatformSaveBackend();

export function configureSaveBackend(backend: SaveBackend): void {
  saveBackend = backend;
}

function logStorageFailure(message: string, error?: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- preserve readable browser storage errors from unknown throws
  logError(message, "storage", error ? { error: String(error) } : undefined);
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
    return applySaveWritePolicy({ data: fallbackSaveData(), status: { kind: "ok" } });
  }

  let candidates: string[];
  try {
    candidates = await collectSaveCandidates();
  } catch (error) {
    logStorageFailure("Save candidates could not be read, falling back to defaults", error);
    return applySaveWritePolicy({ data: fallbackSaveData(), status: { kind: "corrupt" } });
  }

  if (candidates.length === 0) {
    return applySaveWritePolicy({ data: fallbackSaveData(), status: { kind: "ok" } });
  }

  return applySaveWritePolicy(evaluateSaveCandidates(candidates));
}

const saveQueue = new SaveWriteQueue();

export async function resetStorageIoForTests(): Promise<void> {
  await saveQueue.reset();
  setWritesDisabled(false);
  saveBackend = createPlatformSaveBackend();
}

async function writeSaveSnapshot(data: SaveData): Promise<SaveWriteOutcome> {
  let serialized: string;
  try {
    serialized = serializeSaveSnapshot(data);
  } catch (error) {
    logStorageFailure("Save data could not be serialized", error);
    return "failed";
  }
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
  return saveQueue.enqueue(data, writeSaveSnapshot);
}

export function saveAlchemySaveDataForExit(data: SaveData): SaveWriteOutcome | Promise<SaveWriteOutcome> {
  if (typeof window === "undefined" || areWritesDisabled() || saveQueue.isClearPending) return "skipped";

  let serialized: string;
  try {
    serialized = serializeSaveSnapshot(data);
  } catch (error) {
    logStorageFailure("Save data could not be serialized during page exit", error);
    return "failed";
  }
  try {
    const result = saveBackend.writeSync(SAVE_KEY, serialized);
    if (result === null) return saveAlchemySaveData(data);
    if (!result.ok) {
      logStorageFailure("Save data could not be written during page exit", result.error);
      return "failed";
    }
    return saveQueue.isIdle ? "saved" : saveAlchemySaveData(data);
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
  const forceLocalWipe = options?.forceLocalWipe ?? areWritesDisabled();
  return saveQueue.enqueueClear(() => saveBackend.clear(SAVE_KEY, { forceLocalWipe }), {
    keepWritesDisabled: options?.keepWritesDisabled,
    onError: (error) => logStorageFailure("Save data could not be cleared", error),
  });
}
