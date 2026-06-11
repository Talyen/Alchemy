// Browser localStorage IO for alchemy save data.
// Depends on: SAVE_KEY (game-constants), Zod validation schemas (lib/validation), save defaults.
// Used by: use-app-save-state.ts (loadAlchemySaveState), App.tsx (loadAlchemySaveState).
import { SAVE_KEY } from "@/lib/game-constants";
import { platform } from "@/lib/platform";

import {
  SaveDataSchema,
  safeParseWithErrors,
  getRawContentVersion,
  getRawSaveSchemaVersion,
  isUnsupportedFutureContentData,
  isUnsupportedFutureSaveData,
  pickNewerSavePayload,
  CURRENT_SAVE_SCHEMA_VERSION,
} from "@/lib/validation";
import type { SaveData } from "./types";
import { logError } from "@/lib/error-logger";
import { defaultSaveData } from "./defaults";

class SaveSessionState {
  private writesDisabledForSession = false;

  public setWritesDisabled(disabled: boolean) {
    this.writesDisabledForSession = disabled;
  }

  public isWritesDisabled() {
    return this.writesDisabledForSession;
  }
}

const saveSessionState = new SaveSessionState();

// Keeps storage failures readable without crashing gameplay when browsers block persistence.
function logStorageFailure(message: string, error?: unknown) {
  logError(message, "storage", error ? { error: String(error) } : undefined);
}

function collectSaveRepairWarnings(raw: Partial<SaveData>, normalized: SaveData): string[] {
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

export type SaveLoadState = {
  data: SaveData;
  status: SaveLoadStatus;
};

async function readLocalRaw(key: string): Promise<string | null> {
  const local = await platform.storage.readLocal(key);
  if (!local.ok) {
    logStorageFailure("LocalStorage read failed", local.error);
    return null;
  }
  return local.data;
}

async function readStorageItem(key: string): Promise<string | null> {
  const localData = await readLocalRaw(key);

  if (!platform.isDesktop) {
    return localData;
  }

  const cloudData = await platform.storage.readCloudFallback();
  if (localData !== null && cloudData !== null && localData !== cloudData) {
    return pickNewerSavePayload(localData, cloudData);
  }
  if (localData !== null) return localData;
  return cloudData;
}

async function writeStorageItem(key: string, value: string): Promise<{ ok: true } | { ok: false; error: unknown }> {
  const result = await platform.storage.writeLocal(key, value);
  if (result.ok) return { ok: true };
  return { ok: false, error: result.error };
}

async function removeStorageItem(key: string): Promise<{ ok: true } | { ok: false; error: unknown }> {
  const result = await platform.storage.removeLocal(key);
  if (result.ok) return { ok: true };
  return { ok: false, error: result.error };
}

async function backupIfMigrated(raw: string): Promise<void> {
  if (!platform.isDesktop) return;
  try {
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const rawVersion = getRawSaveSchemaVersion(parsed);
    if (rawVersion < CURRENT_SAVE_SCHEMA_VERSION) {
      await platform.storage.backupLocal();
    }
  } catch {
    // Backup is best-effort; load path will fall back to defaults on corrupt JSON.
  }
}

// Loads save data plus status so the app can block unsupported newer saves before gameplay.
export async function loadAlchemySaveState(): Promise<SaveLoadState> {
  if (typeof window === "undefined") {
    return { data: defaultSaveData, status: { kind: "ok" } };
  }

  try {
    const raw = await readStorageItem(SAVE_KEY);
    if (!raw) {
      return { data: defaultSaveData, status: { kind: "ok" } };
    }

    await backupIfMigrated(raw);

    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (isUnsupportedFutureSaveData(parsed)) {
      saveSessionState.setWritesDisabled(true);
      logError("Save data was created by a newer version; update the game to continue this save.", "storage");
      return {
        data: defaultSaveData,
        status: { kind: "unsupported-newer-schema", detectedSchemaVersion: getRawSaveSchemaVersion(parsed) },
      };
    }

    if (isUnsupportedFutureContentData(parsed)) {
      saveSessionState.setWritesDisabled(true);
      logError("Save data contains newer game content; update the game to continue this save.", "storage");
      return {
        data: defaultSaveData,
        status: { kind: "unsupported-newer-content", detectedContentVersion: getRawContentVersion(parsed) },
      };
    }

    saveSessionState.setWritesDisabled(false);
    const parsedResult = safeParseWithErrors(SaveDataSchema, parsed);
    if (!parsedResult.success) {
      logStorageFailure("Save data failed validation, falling back to defaults", parsedResult.error);
      return { data: defaultSaveData, status: { kind: "corrupt" } };
    }
    const data = parsedResult.data as SaveData;
    const warnings = collectSaveRepairWarnings(parsed, data);
    for (const ve of parsedResult.errors) {
      warnings.push(`Field "${ve.path}" was corrupt: ${ve.message}`);
    }
    if (warnings.length > 0) {
      console.info("Save data was normalized during load", warnings);
    }
    return { data, status: warnings.length > 0 ? { kind: "ok", warnings } : { kind: "ok" } };
  } catch (error) {
    logStorageFailure("Save data unavailable or corrupt, falling back to defaults", error);
    return { data: defaultSaveData, status: { kind: "corrupt" } };
  }
}

// Writes the current save snapshot exactly as provided by App/controller state.
export async function saveAlchemySaveData(data: SaveData) {
  if (typeof window === "undefined") {
    return;
  }
  if (saveSessionState.isWritesDisabled()) return;

  try {
    const payload: SaveData = { ...data, lastSavedAt: Date.now() };
    const result = await writeStorageItem(SAVE_KEY, JSON.stringify(payload));
    if (result.ok) return;
    logStorageFailure("Save data could not be written", result.error);
    return;
  } catch (error) {
    logStorageFailure("Save data could not be serialized", error);
  }
}

// Removes the persisted save while leaving in-memory React state reset to callers.
export async function clearAlchemySaveData() {
  if (typeof window === "undefined") {
    return;
  }

  const result = await removeStorageItem(SAVE_KEY);
  if (result.ok) {
    saveSessionState.setWritesDisabled(false);
    return;
  }
  logStorageFailure("Save data could not be cleared", result.error);
}
