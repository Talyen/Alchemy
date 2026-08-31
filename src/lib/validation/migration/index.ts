import { CURRENT_CONTENT_VERSION, CURRENT_SAVE_SCHEMA_VERSION, LAUNCH_SAVE_SCHEMA_VERSION } from "../metadata";
import type { RawSaveData } from "./types";
import { migrateContentV1ToV2, migrateContentV2ToV3 } from "./content-steps";
import { migrateV11ToV12 } from "./steps-v11-v12";
import { migrateV12ToV13 } from "./steps-v12-v13";
import { migrateV13ToV14 } from "./steps-v13-v14";

export function getRawSaveSchemaVersion(parsed: unknown): number {
  if (!parsed || typeof parsed !== "object") return 0;
  const version = (parsed as RawSaveData).saveSchemaVersion;
  if (typeof version !== "number" || !Number.isFinite(version) || !Number.isInteger(version) || version < 0) {
    return 0;
  }
  return version;
}

export function getRawContentVersion(parsed: unknown): number {
  if (!parsed || typeof parsed !== "object") return 0;
  const version = (parsed as RawSaveData).contentVersion;
  if (typeof version !== "number" || !Number.isFinite(version) || !Number.isInteger(version) || version < 0) {
    return 0;
  }
  return version;
}

const SCHEMA_MIGRATIONS: Array<{ from: number; migrate: (data: RawSaveData) => RawSaveData }> = [
  { from: 11, migrate: migrateV11ToV12 },
  { from: 12, migrate: migrateV12ToV13 },
  { from: 13, migrate: migrateV13ToV14 },
];

export function migrateSaveDataToCurrent(parsed: unknown): RawSaveData {
  if (!parsed || typeof parsed !== "object") return {};
  let next = { ...(parsed as RawSaveData) };
  const schemaVersion = getRawSaveSchemaVersion(next);
  if (schemaVersion !== 0 && schemaVersion < LAUNCH_SAVE_SCHEMA_VERSION) {
    return {
      ...next,
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      contentVersion: CURRENT_CONTENT_VERSION,
    };
  }
  let currentVersion = schemaVersion;
  for (const { from, migrate } of SCHEMA_MIGRATIONS) {
    if (currentVersion === from) {
      next = migrate(next);
      currentVersion += 1;
    }
  }
  const contentVersion = getRawContentVersion(next);
  if (contentVersion < 2) next = migrateContentV1ToV2(next);
  if (contentVersion < 3) next = migrateContentV2ToV3(next);
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
