import { CURRENT_CONTENT_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "../metadata";
import { getRawVersion, type RawSaveData } from "./types";
import { migrateContentToCurrentVersion } from "./content-steps";
import { migrateV11ToV12 } from "./steps-v11-v12";
import { migrateV12ToV13 } from "./steps-v12-v13";
import { migrateV13ToV14 } from "./steps-v13-v14";

export function getRawSaveSchemaVersion(parsed: unknown): number {
  return getRawVersion(parsed, "saveSchemaVersion");
}

export function getRawContentVersion(parsed: unknown): number {
  return getRawVersion(parsed, "contentVersion");
}

const SCHEMA_MIGRATIONS: Array<{ from: number; migrate: (data: RawSaveData) => RawSaveData }> = [
  { from: 11, migrate: migrateV11ToV12 },
  { from: 12, migrate: migrateV12ToV13 },
  { from: 13, migrate: migrateV13ToV14 },
];

function migrateContentToCurrent(next: RawSaveData): RawSaveData {
  const contentVersion = getRawContentVersion(next);
  return migrateContentToCurrentVersion(next, contentVersion);
}

export function migrateSaveDataToCurrent(parsed: unknown): RawSaveData {
  if (!parsed || typeof parsed !== "object") return {};
  let next = { ...(parsed as RawSaveData) };
  let currentVersion = getRawSaveSchemaVersion(next);
  while (true) {
    const migrated = SCHEMA_MIGRATIONS.find((m) => m.from === currentVersion);
    if (!migrated) break;
    next = migrated.migrate(next);
    currentVersion += 1;
  }
  next = migrateContentToCurrent(next);
  return {
    ...next,
    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    contentVersion: CURRENT_CONTENT_VERSION,
  };
}

export function isUnsupportedFutureSaveData(parsed: unknown): boolean {
  return getRawSaveSchemaVersion(parsed) > CURRENT_SAVE_SCHEMA_VERSION;
}

export function isUnsupportedFutureContentData(parsed: unknown): boolean {
  return getRawContentVersion(parsed) > CURRENT_CONTENT_VERSION;
}
