import { SAVE_KEY } from "@/lib/game-constants";
import { createPlatformSaveBackend, type SaveBackend } from "@/lib/platform-save-backend";

import {
  SaveDataSchema,
  safeParseWithErrors,
  getRawContentVersion,
  getRawSaveSchemaVersion,
  isUnsupportedFutureContentData,
  isUnsupportedFutureSaveData,
  type ParsedSaveData,
} from "@/lib/validation";
import type { SaveData } from "./types";
import { logError } from "@/lib/error-logger";
import { defaultSaveData } from "./defaults";
import { toActiveRunData } from "@/lib/active-run-session";

let writesDisabledForSession = false;
let saveBackend: SaveBackend = createPlatformSaveBackend();

export function configureSaveBackend(backend: SaveBackend): void {
  saveBackend = backend;
}

function logStorageFailure(message: string, error?: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- preserve readable browser storage errors from unknown throws
  logError(message, "storage", error ? { error: String(error) } : undefined);
}

function collectSaveRepairWarnings(raw: Partial<SaveData>, normalized: ParsedSaveData): string[] {
  const warnings: string[] = [];
  if (raw.activeRun && !normalized.activeRun) {
    warnings.push("active run could not be restored");
  }
  const rawParked =
    raw &&
    typeof raw === "object" &&
    "parkedRuns" in raw &&
    raw.parkedRuns &&
    typeof raw.parkedRuns === "object" &&
    !Array.isArray(raw.parkedRuns)
      ? Object.keys(raw.parkedRuns).length
      : 0;
  const keptParked = Object.keys(normalized.parkedRuns ?? {}).length;
  if (rawParked > keptParked) {
    warnings.push("a parked run could not be restored");
  }
  const rawGold = (raw as { gold?: unknown }).gold;
  if (rawGold !== undefined && rawGold !== normalized.gold) {
    warnings.push(`Field "gold" was repaired (raw ${JSON.stringify(rawGold)} -> ${normalized.gold})`);
  }
  return warnings;
}

type SaveLoadStatus =
  | { kind: "ok"; warnings?: string[] }
  | { kind: "unsupported-newer-schema"; detectedSchemaVersion: number }
  | { kind: "unsupported-newer-content"; detectedContentVersion: number }
  | { kind: "corrupt" };

export interface SaveLoadState {
  data: SaveData;
  status: SaveLoadStatus;
}

function hydrateActiveRunDeck(activeRun: ParsedSaveData["activeRun"]): SaveData["activeRun"] {
  if (!activeRun) return null;
  return toActiveRunData(activeRun);
}

function hydrateParkedRuns(parked: ParsedSaveData["parkedRuns"]): SaveData["parkedRuns"] {
  const next: SaveData["parkedRuns"] = {};
  for (const [mode, run] of Object.entries(parked)) {
    if (!run) continue;
    const hydrated = hydrateActiveRunDeck(run as ParsedSaveData["activeRun"]);
    if (hydrated) next[mode as keyof SaveData["parkedRuns"]] = hydrated;
  }
  return next;
}

async function collectSaveCandidates(): Promise<string[]> {
  const result = await saveBackend.readCandidates(SAVE_KEY);
  if (result.ok) return result.candidates;
  logStorageFailure("Save candidates could not be read", result.error);
  return [];
}

export type SaveCandidateSource = "local" | "backup" | "cloud" | "unknown";

export function evaluateSaveCandidates(candidates: string[]): SaveLoadState {
  for (const candidate of candidates) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate) as unknown;
    } catch (error) {
      logStorageFailure("Save candidate JSON parse failed, trying next candidate", error);
      continue;
    }

    if (isUnsupportedFutureSaveData(parsed)) {
      return {
        data: defaultSaveData,
        status: { kind: "unsupported-newer-schema", detectedSchemaVersion: getRawSaveSchemaVersion(parsed) },
      };
    }
    if (isUnsupportedFutureContentData(parsed)) {
      return {
        data: defaultSaveData,
        status: { kind: "unsupported-newer-content", detectedContentVersion: getRawContentVersion(parsed) },
      };
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      logStorageFailure("Save candidate root was not an object, trying next candidate");
      continue;
    }

    const result = safeParseWithErrors(SaveDataSchema, parsed);
    if (!result.success) {
      logStorageFailure("Save candidate failed validation, trying next candidate", result.error);
      continue;
    }
    const data = result.data;
    const warnings = collectSaveRepairWarnings(parsed, data);
    for (const ve of result.errors) {
      warnings.push(`Field "${ve.path}" was corrupt: ${ve.message}`);
    }
    const hydrated: SaveData = {
      ...data,
      activeRun: hydrateActiveRunDeck(data.activeRun),
      parkedRuns: hydrateParkedRuns(data.parkedRuns),
    };
    if (warnings.length > 0) console.warn("Save data was normalized during load", warnings);
    return { data: hydrated, status: warnings.length > 0 ? { kind: "ok", warnings } : { kind: "ok" } };
  }

  return { data: defaultSaveData, status: { kind: "corrupt" } };
}

function applySaveWritePolicy(result: SaveLoadState): SaveLoadState {
  if (result.status.kind === "unsupported-newer-schema" || result.status.kind === "unsupported-newer-content") {
    writesDisabledForSession = true;
  } else {
    writesDisabledForSession = false;
  }
  return result;
}

export async function loadAlchemySaveState(): Promise<SaveLoadState> {
  if (typeof window === "undefined") {
    return applySaveWritePolicy({ data: defaultSaveData, status: { kind: "ok" } });
  }

  let candidates: string[];
  try {
    candidates = await collectSaveCandidates();
  } catch (error) {
    logStorageFailure("Save candidates could not be read, falling back to defaults", error);
    return applySaveWritePolicy({ data: defaultSaveData, status: { kind: "corrupt" } });
  }

  if (candidates.length === 0) {
    return applySaveWritePolicy({ data: defaultSaveData, status: { kind: "ok" } });
  }

  return applySaveWritePolicy(evaluateSaveCandidates(candidates));
}

class SaveWriteQueue {
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

  async enqueueClear(clear: () => Promise<{ ok: boolean }>, keepWritesDisabled?: boolean): Promise<boolean> {
    this.clearPending = true;
    this.coalesced = null;
    let cleared = false;
    const run = this.chain.then(async () => {
      try {
        this.coalesced = null;
        const result = await clear();
        if (result.ok) {
          if (!keepWritesDisabled) writesDisabledForSession = false;
          cleared = true;
          return;
        }
        logStorageFailure("Save data could not be cleared", (result as { error?: unknown }).error);
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

const saveQueue = new SaveWriteQueue();

export async function resetStorageIoForTests(): Promise<void> {
  await saveQueue.reset();
  writesDisabledForSession = false;
  saveBackend = createPlatformSaveBackend();
}

async function writeSaveSnapshot(data: SaveData): Promise<void> {
  try {
    const result = await saveBackend.write(SAVE_KEY, serializeSaveSnapshot(data));
    if (result.ok) return;
    logStorageFailure("Save data could not be written", result.error);
  } catch (error) {
    logStorageFailure("Save data could not be serialized", error);
  }
}

function serializeSaveSnapshot(data: SaveData, now: number = Date.now()): string {
  const payload: SaveData = { ...data, lastSavedAt: now };
  return JSON.stringify(payload);
}

export async function saveAlchemySaveData(data: SaveData) {
  if (typeof window === "undefined") return;
  await saveQueue.enqueue(data, writeSaveSnapshot);
}

export function saveAlchemySaveDataForExit(data: SaveData): void {
  if (typeof window === "undefined" || writesDisabledForSession || saveQueue.isClearPending) return;

  if (!saveBackend.writeSync) {
    if (saveQueue.hasPendingTasks) {
      saveQueue.queueExitSnapshot(data);
      return;
    }
    void saveAlchemySaveData(data);
    return;
  }

  try {
    const result = saveBackend.writeSync(SAVE_KEY, serializeSaveSnapshot(data));
    if (result === null) {
      void saveAlchemySaveData(data);
      return;
    }
    if (!result.ok) {
      logStorageFailure("Save data could not be written during page exit", result.error);
      void saveAlchemySaveData(data);
      return;
    }

    saveQueue.queueExitSnapshot(data);
  } catch (error) {
    logStorageFailure("Save data could not be serialized during page exit", error);
    void saveAlchemySaveData(data);
  }
}

export async function clearAlchemySaveData(options?: { keepWritesDisabled?: boolean }): Promise<boolean> {
  if (typeof window === "undefined") return true;
  return saveQueue.enqueueClear(() => saveBackend.clear(SAVE_KEY), options?.keepWritesDisabled);
}
