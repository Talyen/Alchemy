// Browser localStorage IO for alchemy save data.
// Depends on: SAVE_KEY (game-constants), Zod validation schemas (lib/validation), save defaults.
// Used by: use-app-save-state.ts (loadAlchemySaveState), App.tsx (loadAlchemySaveState).
import { SAVE_KEY } from "@/lib/game-constants";
import { createPlatformSaveBackend, type SaveBackend } from "@/lib/platform-save-backend";

import {
  SaveDataSchema,
  safeParseWithErrors,
  getRawContentVersion,
  getRawSaveSchemaVersion,
  isTombstonedCardId,
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

// Keeps storage failures readable without crashing gameplay when browsers block persistence.
function logStorageFailure(message: string, error?: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- preserve readable browser storage errors from unknown throws
  logError(message, "storage", error ? { error: String(error) } : undefined);
}

function collectSaveRepairWarnings(raw: Partial<SaveData>, normalized: ParsedSaveData): string[] {
  const warnings: string[] = [];
  if (raw.activeRun && !normalized.activeRun) {
    warnings.push("active run could not be restored");
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

// Drops intentionally tombstoned card IDs, then hydrates remaining cards into the
// runtime ActiveRunData contract. Unknown non-tombstoned IDs (e.g. E2E fixtures)
// are kept so fully-specified saved cards remain drawable.
function hydrateActiveRunDeck(activeRun: ParsedSaveData["activeRun"]): SaveData["activeRun"] {
  if (!activeRun) return null;
  const keepCard = (card: { id: string }) => !isTombstonedCardId(card.id);
  return toActiveRunData({
    ...activeRun,
    runDeck: activeRun.runDeck.filter(keepCard),
    wildwoodDraft: activeRun.wildwoodDraft
      ? {
          ...activeRun.wildwoodDraft,
          draftChoices: activeRun.wildwoodDraft.draftChoices.filter(keepCard),
        }
      : null,
  });
}

async function collectSaveCandidates(): Promise<string[]> {
  const result = await saveBackend.readCandidates(SAVE_KEY);
  if (result.ok) return result.candidates;
  logStorageFailure("Save candidates could not be read", result.error);
  return [];
}

async function writeStorageItem(key: string, value: string): Promise<{ ok: true } | { ok: false; error: unknown }> {
  const result = await saveBackend.write(key, value);
  if (result.ok) return { ok: true };
  return { ok: false, error: result.error };
}

async function removeStorageItem(key: string): Promise<{ ok: true } | { ok: false; error: unknown }> {
  const result = await saveBackend.clear(key);
  if (result.ok) return { ok: true };
  return { ok: false, error: result.error };
}

function evaluateSaveCandidates(candidates: string[]): SaveLoadState {
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
    const hydrated: SaveData = { ...data, activeRun: hydrateActiveRunDeck(data.activeRun) };
    if (warnings.length > 0) console.warn("Save data was normalized during load", warnings);
    return { data: hydrated, status: warnings.length > 0 ? { kind: "ok", warnings } : { kind: "ok" } };
  }

  return { data: defaultSaveData, status: { kind: "corrupt" } };
}

function applySaveWritePolicy(result: SaveLoadState): SaveLoadState {
  if (result.status.kind === "unsupported-newer-schema" || result.status.kind === "unsupported-newer-content") {
    writesDisabledForSession = true;
  } else if (result.status.kind === "ok") {
    writesDisabledForSession = false;
  }
  return result;
}

// Loads save data plus status. On desktop, candidates are walked in preference
// order: local, bak.1, bak.2, bak.3, cloud. Each candidate is parsed and
// Zod-validated before being accepted. Corrupt candidates fall through to the
// next recovery source. A future-versioned candidate protects itself and all
// lower-priority candidates from writes; otherwise the first valid candidate wins.
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

// Serializes overlapping saves so desktop IPC tmp writes never interleave.
// Concurrent callers coalesce to the latest snapshot; each awaiter waits for
// its place in the chain (which may write a newer snapshot than it submitted).
let saveWriteChain: Promise<void> = Promise.resolve();
let coalescedSave: SaveData | null = null;
let clearPending = false;

/** Test-only isolation for module-scoped write policy and queue state. */
export async function resetStorageIoForTests(): Promise<void> {
  await saveWriteChain.catch(() => {});
  writesDisabledForSession = false;
  saveBackend = createPlatformSaveBackend();
  saveWriteChain = Promise.resolve();
  coalescedSave = null;
  clearPending = false;
}

async function writeSaveSnapshot(data: SaveData): Promise<void> {
  try {
    const result = await writeStorageItem(SAVE_KEY, serializeSaveSnapshot(data));
    if (result.ok) return;
    logStorageFailure("Save data could not be written", result.error);
  } catch (error) {
    logStorageFailure("Save data could not be serialized", error);
  }
}

function serializeSaveSnapshot(data: SaveData): string {
  const payload: SaveData = { ...data, lastSavedAt: Date.now() };
  return JSON.stringify(payload);
}

// Writes the current save snapshot exactly as provided by App/controller state.
export async function saveAlchemySaveData(data: SaveData) {
  if (typeof window === "undefined") {
    return;
  }
  if (writesDisabledForSession) return;

  coalescedSave = data;
  const run = saveWriteChain.then(async () => {
    while (coalescedSave !== null && !clearPending) {
      const snapshot = coalescedSave;
      coalescedSave = null;
      if (writesDisabledForSession) return;
      await writeSaveSnapshot(snapshot);
    }
  });
  // Keep the chain alive even if a write logs-and-continues; never reject the gate.
  saveWriteChain = run.catch(() => {});
  await run;
}

/**
 * Flushes the latest browser snapshot synchronously during page lifecycle exit.
 * Desktop IPC cannot be made synchronous, so it falls back to the normal serialized queue.
 */
export function saveAlchemySaveDataForExit(data: SaveData): void {
  if (typeof window === "undefined" || writesDisabledForSession) return;

  if (!saveBackend.writeSync) {
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

    // A queued, not-yet-started snapshot must not overwrite the terminal snapshot.
    coalescedSave = null;
  } catch (error) {
    logStorageFailure("Save data could not be serialized during page exit", error);
    void saveAlchemySaveData(data);
  }
}

// Removes the persisted save while leaving in-memory React state reset to callers.
// Returns false when the wipe could not complete (e.g. Steam Cloud delete failed) so
// callers like Save Protected can fail closed instead of reloading into the same block.
export async function clearAlchemySaveData(): Promise<boolean> {
  if (typeof window === "undefined") {
    return true;
  }

  clearPending = true;
  coalescedSave = null;
  let cleared = false;
  const run = saveWriteChain.then(async () => {
    try {
      coalescedSave = null;
      const result = await removeStorageItem(SAVE_KEY);
      if (result.ok) {
        writesDisabledForSession = false;
        cleared = true;
        return;
      }
      logStorageFailure("Save data could not be cleared", result.error);
    } finally {
      coalescedSave = null;
      clearPending = false;
    }
  });
  // Keep the chain alive even if clear logs-and-continues; never reject the gate.
  saveWriteChain = run.catch(() => {
    coalescedSave = null;
    clearPending = false;
  });
  try {
    await run;
  } catch {
    return false;
  }
  return cleared;
}
