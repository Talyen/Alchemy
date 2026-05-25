// Browser localStorage IO for alchemy save data.
// Depends on: SAVE_KEY (game-constants), Zod validation schemas (lib/validation), save defaults.
// Used by: use-app-save-state.ts (loadAlchemySaveState), App.tsx (loadAlchemySaveState).
import { SAVE_KEY } from "@/lib/game-constants";

import {
  SaveDataSchema,
  getAndClearValidationErrors,
  getRawContentVersion,
  getRawSaveSchemaVersion,
  isUnsupportedFutureContentData,
  isUnsupportedFutureSaveData,
} from "@/lib/validation";
import type { SaveData } from "./types";
import { defaultSaveData } from "./defaults";

let writesDisabledForSession = false;

function readStorageItem(key: string): string | null {
  return window.localStorage.getItem(key);
}

type StorageOperationResult = { ok: true } | { ok: false; error: unknown };

function writeStorageItem(key: string, value: string): StorageOperationResult {
  try {
    window.localStorage.setItem(key, value);
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

function removeStorageItem(key: string): StorageOperationResult {
  try {
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
export function loadAlchemySaveState(): SaveLoadState {
  if (typeof window === "undefined") {
    return { data: defaultSaveData, status: { kind: "ok" } };
  }

  try {
    const raw = readStorageItem(SAVE_KEY);
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
    const result = SaveDataSchema.safeParse(parsed);
    const validationErrors = getAndClearValidationErrors();
    if (!result.success) {
      writesDisabledForSession = true;
      logStorageFailure("Save data failed validation, falling back to defaults", result.error);
      return { data: defaultSaveData, status: { kind: "corrupt" } };
    }
    const data = result.data as SaveData;
    const warnings = collectSaveRepairWarnings(parsed, data);
    for (const ve of validationErrors) {
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
export function saveAlchemySaveData(data: SaveData) {
  if (typeof window === "undefined") {
    return;
  }
  if (writesDisabledForSession) return;

  try {
    const result = writeStorageItem(SAVE_KEY, JSON.stringify(data));
    if (result.ok) return;
    logStorageFailure("Save data could not be written", result.error);
    return;
  } catch (error) {
    logStorageFailure("Save data could not be serialized", error);
  }
}

// Removes the persisted save while leaving in-memory React state reset to callers.
export function clearAlchemySaveData() {
  if (typeof window === "undefined") {
    return;
  }

  const result = removeStorageItem(SAVE_KEY);
  if (result.ok) {
    writesDisabledForSession = false;
    return;
  }
  logStorageFailure("Save data could not be cleared", result.error);
}
