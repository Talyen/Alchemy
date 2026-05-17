// Browser localStorage IO for alchemy save data.
// Depends on the save key constant, save defaults, and Zod validation schemas.
import { SAVE_KEY } from "@/lib/game-constants";

import { SaveDataSchema, getRawSaveSchemaVersion, isUnsupportedFutureSaveData } from "@/lib/validation";
import type { SaveData } from "./types";
import { defaultSaveData } from "./defaults";

const storageKey = SAVE_KEY;
let writesDisabledForSession = false;

function readStorageItem(key: string): string | null {
  return window.localStorage.getItem(key);
}

function writeStorageItem(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeStorageItem(key: string): boolean {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export type SaveLoadStatus =
  | { kind: "ok" }
  | { kind: "unsupported-newer-schema"; detectedSchemaVersion: number }
  | { kind: "corrupt" };

export type SaveLoadState = {
  data: SaveData;
  status: SaveLoadStatus;
};

// Loads and normalizes save data, falling back safely when localStorage is unavailable or corrupt.
export function loadAlchemySaveData(): SaveData {
  return loadAlchemySaveState().data;
}

// Loads save data plus status so the app can block unsupported newer saves before gameplay.
export function loadAlchemySaveState(): SaveLoadState {
  if (typeof window === "undefined") {
    return { data: defaultSaveData, status: { kind: "ok" } };
  }

  try {
    const raw = readStorageItem(storageKey);
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

    writesDisabledForSession = false;
    const result = SaveDataSchema.safeParse(parsed);
    return { data: result.data as SaveData, status: { kind: "ok" } };
  } catch {
    writesDisabledForSession = false;
    console.error("Save data unavailable or corrupt, falling back to defaults");
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
    if (writeStorageItem(storageKey, JSON.stringify(data))) return;
  } catch {
    // Fall through to the shared write failure log.
  }
  console.error("Save data could not be written");
}

// Removes the persisted save while leaving in-memory React state reset to callers.
export function clearAlchemySaveData() {
  if (typeof window === "undefined") {
    return;
  }

  if (removeStorageItem(storageKey)) {
    writesDisabledForSession = false;
    return;
  }
  console.error("Save data could not be cleared");
}
