import { CURRENT_CONTENT_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "../metadata";
import type { RawSaveData } from "./types";
import { migrateContentV1ToV2, migrateContentV2ToV3 } from "./content-steps";
import { migrateV11ToV12 } from "./steps-v11-v12";
import { migrateV12ToV13 } from "./steps-v12-v13";

/** Returns 0 for invalid versions so callers can treat missing-version saves as v0. */
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

/**
 * Stamp the current schema version onto a parsed payload.
 * Schema steps exist from the launch floor (v11) through CURRENT (v13).
 * Older local saves are unsupported; Zod defaults repair the envelope.
 */
export function migrateSaveDataToCurrent(parsed: unknown): RawSaveData {
  if (!parsed || typeof parsed !== "object") return {};
  let next = { ...(parsed as RawSaveData) };
  const schemaVersion = getRawSaveSchemaVersion(next);
  if (schemaVersion <= 11) {
    next = migrateV11ToV12(next);
  }
  if (schemaVersion <= 12) {
    next = migrateV12ToV13(next);
  }
  const contentVersion = getRawContentVersion(next);
  if (contentVersion < 2) {
    next = migrateContentV1ToV2(next);
  }
  if (contentVersion < 3) {
    next = migrateContentV2ToV3(next);
  }
  return {
    ...next,
    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    contentVersion: CURRENT_CONTENT_VERSION,
  };
}

/** Saves from newer schema versions are blocked so older builds cannot overwrite them. */
export function isUnsupportedFutureSaveData(parsed: unknown): boolean {
  return getRawSaveSchemaVersion(parsed) > CURRENT_SAVE_SCHEMA_VERSION;
}

export function isUnsupportedFutureContentData(parsed: unknown): boolean {
  return getRawContentVersion(parsed) > CURRENT_CONTENT_VERSION;
}
