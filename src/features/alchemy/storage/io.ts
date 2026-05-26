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
} from "@/lib/validation";
import type { SaveData } from "./types";
import { defaultSaveData } from "./defaults";

const DESKTOP_SAVE_FILENAME = "save.json";

let writesDisabledForSession = false;

async function readStorageItem(key: string): Promise<string | null> {
  if (platform.isDesktop && window.alchemyDesktop) {
    const localData = await window.alchemyDesktop.loadSave();
    if (localData !== null) return localData;
    if (platform.cloud.isAvailable) {
      try {
        const cloudData = await platform.cloud.read(DESKTOP_SAVE_FILENAME);
        if (cloudData !== null) return cloudData;
      } catch {
        // fallback to defaults
      }
    }
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

type StorageOperationResult = { ok: true } | { ok: false; error: unknown };

async function writeStorageItem(key: string, value: string): Promise<StorageOperationResult> {
  try {
    if (platform.isDesktop && window.alchemyDesktop) {
      if (platform.cloud.isAvailable) {
        const cloudOk = await platform.cloud.write(DESKTOP_SAVE_FILENAME, value);
        if (!cloudOk) {
          console.warn("Steam Cloud write failed, save may not sync");
        }
      }
      const ok = await window.alchemyDesktop.writeSave(value);
      if (ok) return { ok: true };
      throw new Error("Failed to write desktop save file");
    }
    window.localStorage.setItem(key, value);
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

async function removeStorageItem(key: string): Promise<StorageOperationResult> {
  try {
    if (platform.isDesktop && window.alchemyDesktop) {
      if (platform.cloud.isAvailable) {
        const cloudOk = await platform.cloud.delete(DESKTOP_SAVE_FILENAME);
        if (!cloudOk) {
          console.warn("Steam Cloud delete failed, save may remain in cloud");
        }
      }
      const ok = await window.alchemyDesktop.clearSave();
      if (ok) return { ok: true };
      throw new Error("Failed to clear desktop save file");
    }
    window.localStorage.removeItem(key);
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

// Keeps storage failures readable without crashing gameplay when browsers block persistence.
function logStorageFailure(message: string, error?: unknown) {
  if (error === undefined) {
    console.error(message);
    return;
  }
  console.error(message, error);
}

function collectSaveRepairWarnings(raw: Partial<SaveData>, normalized: SaveData): string[] {
  const warnings: string[] = [];
  if (raw.activeRun && !normalized.activeRun) {
    warnings.push("active run could not be restored");
  }
  return warnings;
}

export type SaveLoadStatus =
  | { kind: "ok"; warnings?: string[] }
  | { kind: "unsupported-newer-schema"; detectedSchemaVersion: number }
  | { kind: "unsupported-newer-content"; detectedContentVersion: number }
  | { kind: "corrupt" };

export type SaveLoadState = {
  data: SaveData;
  status: SaveLoadStatus;
};

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

    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (isUnsupportedFutureSaveData(parsed)) {
      writesDisabledForSession = true;
      console.error("Save data was created by a newer version; update the game to continue this save.");
      return {
        data: defaultSaveData,
        status: { kind: "unsupported-newer-schema", detectedSchemaVersion: getRawSaveSchemaVersion(parsed) },
      };
    }

    if (isUnsupportedFutureContentData(parsed)) {
      writesDisabledForSession = true;
      console.error("Save data contains newer game content; update the game to continue this save.");
      return {
        data: defaultSaveData,
        status: { kind: "unsupported-newer-content", detectedContentVersion: getRawContentVersion(parsed) },
      };
    }

    writesDisabledForSession = false;
    const parsedResult = safeParseWithErrors(SaveDataSchema, parsed);
    if (!parsedResult.success) {
      writesDisabledForSession = true;
      logStorageFailure("Save data failed validation, falling back to defaults", parsedResult.error);
      return { data: defaultSaveData, status: { kind: "corrupt" } };
    }
    const data = parsedResult.data as SaveData;
    const warnings = collectSaveRepairWarnings(parsed, data);
    for (const ve of parsedResult.errors) {
      warnings.push(`Field "${ve.path}" was corrupt: ${ve.message}`);
    }
    if (warnings.length > 0) {
      writesDisabledForSession = true;
      console.info("Save data was normalized during load", warnings);
    }
    return { data, status: warnings.length > 0 ? { kind: "ok", warnings } : { kind: "ok" } };
  } catch (error) {
    writesDisabledForSession = true;
    logStorageFailure("Save data unavailable or corrupt, falling back to defaults", error);
    return { data: defaultSaveData, status: { kind: "corrupt" } };
  }
}

// Writes the current save snapshot exactly as provided by App/controller state.
export async function saveAlchemySaveData(data: SaveData) {
  if (typeof window === "undefined") {
    return;
  }
  if (writesDisabledForSession) return;

  try {
    const result = await writeStorageItem(SAVE_KEY, JSON.stringify(data));
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
    writesDisabledForSession = false;
    return;
  }
  logStorageFailure("Save data could not be cleared", result.error);
}
