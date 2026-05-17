// Browser localStorage IO for alchemy save data.
// Depends on the save key constant, save defaults, and migration helpers.
import { SAVE_KEY } from "@/lib/game-constants";

import { getRawSaveSchemaVersion, isUnsupportedFutureSaveData, normalizeSaveData } from "./migrations";
import type { SaveData } from "./types";
import { defaultSaveData } from "./defaults";

const storageKey = SAVE_KEY;
let writesDisabledForSession = false;

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
    const raw = window.localStorage.getItem(storageKey);
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
    return { data: normalizeSaveData(parsed), status: { kind: "ok" } };
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
    window.localStorage.setItem(storageKey, JSON.stringify(data));
  } catch {
    console.error("Save data could not be written");
  }
}

// Removes the persisted save while leaving in-memory React state reset to callers.
export function clearAlchemySaveData() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(storageKey);
    writesDisabledForSession = false;
  } catch {
    console.error("Save data could not be cleared");
  }
}
