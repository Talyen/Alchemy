// Default save envelope composed from defaults owned by each persistence domain.
import type { SaveData } from "./types";
import { CURRENT_CONTENT_VERSION, CURRENT_GAME_BUILD_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import { settingsPersistenceCodec } from "../stores/settings-store";
import { profilePersistenceCodec } from "../stores/profile-store";
import { gearPersistenceCodec } from "../stores/gear-store";
import { runProfilePersistenceCodec } from "../stores/run-save-readers";

export const defaultSaveData: SaveData = {
  saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
  gameBuildVersion: CURRENT_GAME_BUILD_VERSION,
  contentVersion: CURRENT_CONTENT_VERSION,
  ...settingsPersistenceCodec.createDefault(),
  ...profilePersistenceCodec.createDefault(),
  ...gearPersistenceCodec.createDefault(),
  ...runProfilePersistenceCodec.createDefault(),
  activeRun: null,
  parkedRuns: {},
  runRecency: [],
  lastSavedAt: 0,
};
