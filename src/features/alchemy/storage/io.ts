// Browser localStorage IO for alchemy save data.
// Depends on the save key constant, save defaults, and migration helpers.
import { SAVE_KEY } from "@/lib/game-constants";

import { normalizeSaveData } from "./migrations";
import { defaultSaveData, type SaveData } from "./types";

const storageKey = SAVE_KEY;

// Loads and normalizes save data, falling back safely when localStorage is unavailable or corrupt.
export function loadAlchemySaveData(): SaveData {
  if (typeof window === "undefined") {
    return defaultSaveData;
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return defaultSaveData;
  }

  try {
    return normalizeSaveData(JSON.parse(raw) as Partial<SaveData>);
  } catch {
    return defaultSaveData;
  }
}

// Writes the current save snapshot exactly as provided by App/controller state.
export function saveAlchemySaveData(data: SaveData) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(data));
}

// Removes the persisted save while leaving in-memory React state reset to callers.
export function clearAlchemySaveData() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(storageKey);
}
