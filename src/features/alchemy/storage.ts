import { starterDeck } from "@/lib/game-data";

import type { ResolutionOption } from "./types";

const storageKey = "alchemy-save-v1";

type SaveData = {
  selectedResolution: ResolutionOption;
  discoveredCardIds: string[];
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
};

export const defaultSaveData: SaveData = {
  selectedResolution: "1920x1080",
  discoveredCardIds: starterDeck.map((card) => card.id),
  encounteredEnemyIds: [],
  discoveredTrinketIds: [],
};

export function loadAlchemySaveData(): SaveData {
  if (typeof window === "undefined") {
    return defaultSaveData;
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return defaultSaveData;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      selectedResolution: parsed.selectedResolution ?? defaultSaveData.selectedResolution,
      discoveredCardIds: Array.isArray(parsed.discoveredCardIds) ? parsed.discoveredCardIds : defaultSaveData.discoveredCardIds,
      encounteredEnemyIds: Array.isArray(parsed.encounteredEnemyIds) ? parsed.encounteredEnemyIds : defaultSaveData.encounteredEnemyIds,
      discoveredTrinketIds: Array.isArray(parsed.discoveredTrinketIds) ? parsed.discoveredTrinketIds : defaultSaveData.discoveredTrinketIds,
    };
  } catch {
    return defaultSaveData;
  }
}

export function saveAlchemySaveData(data: SaveData) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(data));
}

export function clearAlchemySaveData() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(storageKey);
}
