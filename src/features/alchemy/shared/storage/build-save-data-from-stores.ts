// Builds the save envelope from domain-owned persistence codecs plus active-run state.
import { CURRENT_CONTENT_VERSION, CURRENT_GAME_BUILD_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import type { ActiveRunData } from "@/lib/active-run-session";
import type { SaveData } from "./types";
import { encodeAlchemyPersistenceFields } from "./persistence-coordinator";

export function buildAlchemySaveDataFromStores(activeRun: ActiveRunData | null): SaveData {
  return {
    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    gameBuildVersion: CURRENT_GAME_BUILD_VERSION,
    contentVersion: CURRENT_CONTENT_VERSION,
    ...encodeAlchemyPersistenceFields(),
    activeRun,
    lastSavedAt: Date.now(),
  };
}
