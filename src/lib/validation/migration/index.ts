import { CURRENT_CONTENT_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "../metadata";
import { getRawVersion, type RawSaveData } from "./types";
import { migrateContentToCurrentVersion } from "./content-steps";
import { migrateV11ToV12 } from "./steps-v11-v12";
import { migrateV12ToV13 } from "./steps-v12-v13";
import { migrateV13ToV14 } from "./steps-v13-v14";
import { migrateV14ToV15 } from "./steps-v14-v15";
import { migrateV15ToV16 } from "./steps-v15-v16";
import { migrateV16ToV17 } from "./steps-v16-v17";
import { migrateV17ToV18 } from "./steps-v17-v18";

export function getRawSaveSchemaVersion(parsed: unknown): number {
  return getRawVersion(parsed, "saveSchemaVersion");
}

export function getRawContentVersion(parsed: unknown): number {
  return getRawVersion(parsed, "contentVersion");
}

export function getRawLastSavedAt(parsed: unknown): number | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const value = (parsed as Record<string, unknown>).lastSavedAt;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

// Ordered step list; versions are derived from position so gaps are impossible.
// v11→v12 stays bespoke (top-level gear) via its own export; the rest use
// defineRunStep. Add new steps by appending here and bumping metadata.
const ORDERED_RUN_MIGRATIONS: Array<(data: RawSaveData) => RawSaveData> = [
  migrateV11ToV12,
  migrateV12ToV13,
  migrateV13ToV14,
  migrateV14ToV15,
  migrateV15ToV16,
  migrateV16ToV17,
  migrateV17ToV18,
];

const FIRST_VERSION = 11;

export const SCHEMA_MIGRATIONS: Array<{ from: number; to: number; migrate: (data: RawSaveData) => RawSaveData }> =
  ORDERED_RUN_MIGRATIONS.map((migrate, index) => ({
    from: FIRST_VERSION + index,
    to: FIRST_VERSION + index + 1,
    migrate,
  }));

// Steps advance exactly one version per iteration (to = from + 1), so more
// iterations than table entries means versions are not progressing through
// the table — the only way this loop can fail to terminate.

function migrateContentToCurrent(next: RawSaveData): RawSaveData {
  const contentVersion = getRawContentVersion(next);
  return migrateContentToCurrentVersion(next, contentVersion);
}

export function migrateSaveDataToCurrent(parsed: unknown): RawSaveData {
  if (!parsed || typeof parsed !== "object") return {};
  // Fast path: already-current saves skip the content-remap deep clone on every parse.
  if (
    getRawSaveSchemaVersion(parsed) === CURRENT_SAVE_SCHEMA_VERSION &&
    getRawContentVersion(parsed) === CURRENT_CONTENT_VERSION
  ) {
    return { ...(parsed as RawSaveData) };
  }
  let next = { ...(parsed as RawSaveData) };
  let currentVersion = getRawSaveSchemaVersion(next);
  for (let step = 0; step <= SCHEMA_MIGRATIONS.length; step += 1) {
    const migrated = SCHEMA_MIGRATIONS.find((m) => m.from === currentVersion);
    if (!migrated) break;
    if (step === SCHEMA_MIGRATIONS.length) throw new Error("Save migration did not terminate");
    next = migrated.migrate(next);
    // Progress is table-driven (to = from + 1); steps operate on unversioned
    // trees and rely on the final stamp below.
    currentVersion = migrated.to;
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
