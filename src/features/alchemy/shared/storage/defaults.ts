import type { SaveData } from "./types";
import { CURRENT_CONTENT_VERSION, CURRENT_GAME_BUILD_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import { createDefaultPersistenceFields } from "./persistence";
import { deepFreezeInDev } from "../stores/store-utils";

export function createDefaultSaveData(): SaveData {
  return {
    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    gameBuildVersion: CURRENT_GAME_BUILD_VERSION,
    contentVersion: CURRENT_CONTENT_VERSION,
    ...createDefaultPersistenceFields(),
    activeRun: null,
    parkedRuns: {},
    runRecency: [],
    lastSavedAt: 0,
  };
}

export const defaultSaveData: SaveData = createDefaultSaveData();

deepFreezeInDev(defaultSaveData);
