// Default save envelope composed from the single codec registry.
import type { SaveData } from "./types";
import { CURRENT_CONTENT_VERSION, CURRENT_GAME_BUILD_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import { createDefaultPersistenceFields } from "./codec-registry";

export const defaultSaveData: SaveData = {
  saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
  gameBuildVersion: CURRENT_GAME_BUILD_VERSION,
  contentVersion: CURRENT_CONTENT_VERSION,
  ...createDefaultPersistenceFields(),
  activeRun: null,
  parkedRuns: {},
  runRecency: [],
  lastSavedAt: 0,
};
