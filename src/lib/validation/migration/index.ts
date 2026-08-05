import { CURRENT_CONTENT_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "../metadata";
import { migrateContentV2 } from "./migrate-content-v2";
import { migrateActiveRun } from "./migrate-active-run";
import { migrateV8ToV9, migrateV9ToV10 } from "./steps";
import type { RawSaveData } from "./types";

// Returns 0 for invalid versions so callers can treat missing-version saves as v0.
export function getRawSaveSchemaVersion(parsed: unknown): number {
  if (!parsed || typeof parsed !== "object") return 0;
  const version = (parsed as RawSaveData).saveSchemaVersion;
  if (typeof version !== "number" || !Number.isFinite(version) || !Number.isInteger(version) || version < 0) return 0;
  return version;
}

export function getRawContentVersion(parsed: unknown): number {
  if (!parsed || typeof parsed !== "object") return 0;
  const version = (parsed as RawSaveData).contentVersion;
  if (typeof version !== "number" || !Number.isFinite(version) || !Number.isInteger(version) || version < 0) return 0;
  return version;
}

const SCHEMA_MIGRATIONS: Array<{ targetVersion: number; migrate: (data: RawSaveData) => RawSaveData }> = [
  { targetVersion: 9, migrate: migrateV8ToV9 },
  { targetVersion: 10, migrate: migrateV9ToV10 },
];

export function migrateSaveDataToCurrent(parsed: unknown): RawSaveData {
  if (!parsed || typeof parsed !== "object") return {};
  let current = { ...(parsed as RawSaveData) };
  let version = getRawSaveSchemaVersion(current);

  for (const step of SCHEMA_MIGRATIONS) {
    if (version >= step.targetVersion) continue;
    current = step.migrate(current);
    version = step.targetVersion;
  }

  if (getRawContentVersion(current) < CURRENT_CONTENT_VERSION) {
    current = migrateContentV2(current);
  }
  if (current.activeRun && typeof current.activeRun === "object") {
    current = { ...current, activeRun: migrateActiveRun(current.activeRun) };
  }
  return { ...current, saveSchemaVersion: version };
}

// Saves from newer schema versions are intentionally blocked: an older build must not
// silently overwrite progress it does not understand.
export function isUnsupportedFutureSaveData(parsed: unknown): boolean {
  return getRawSaveSchemaVersion(parsed) > CURRENT_SAVE_SCHEMA_VERSION;
}

export function isUnsupportedFutureContentData(parsed: unknown): boolean {
  return getRawContentVersion(parsed) > CURRENT_CONTENT_VERSION;
}
