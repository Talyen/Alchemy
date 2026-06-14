import { CURRENT_CONTENT_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "../metadata";
import { migrateActiveRun } from "./migrate-active-run";
import { migrateV0ToV1, migrateV1ToV2, migrateV2ToV3, migrateV3ToV4, normalizeLegacyAspectRatio } from "./steps";
import type { RawSaveData } from "./types";

// Returns 0 for any invalid version so callers can treat missing-version saves as v0.
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

// Runs all historical migrations in sequence, then applies the legacy aspect-ratio rename.
// ORDERING IS IMPORTANT: aspect-ratio normalization runs last because it reads the field
// written by earlier steps. Each migration step must be idempotent for already-migrated saves.
export function migrateSaveDataToCurrent(parsed: unknown): RawSaveData {
  if (!parsed || typeof parsed !== "object") return {};
  let current = { ...(parsed as RawSaveData) };
  let version = getRawSaveSchemaVersion(current);
  if (version < 1) {
    current = migrateV0ToV1(current);
    version = 1;
  }
  if (version < 2) {
    current = migrateV1ToV2(current);
    version = 2;
  }
  if (version < 3) {
    current = migrateV2ToV3(current);
    version = 3;
  }
  if (version < 4) {
    current = migrateV3ToV4(current);
    version = 4;
  }
  if (current.activeRun && typeof current.activeRun === "object") {
    current = { ...current, activeRun: migrateActiveRun(current.activeRun) };
  }
  return normalizeLegacyAspectRatio({ ...current, saveSchemaVersion: version });
}

// Saves from newer schema versions are intentionally blocked: an older build must not
// silently overwrite progress it does not understand.
export function isUnsupportedFutureSaveData(parsed: unknown): boolean {
  return getRawSaveSchemaVersion(parsed) > CURRENT_SAVE_SCHEMA_VERSION;
}

export function isUnsupportedFutureContentData(parsed: unknown): boolean {
  return getRawContentVersion(parsed) > CURRENT_CONTENT_VERSION;
}
