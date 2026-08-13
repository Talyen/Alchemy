import { CURRENT_CONTENT_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "../metadata";
import type { RawSaveData } from "./types";
import { migrateContentV1ToV2 } from "./content-steps";

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
 * Pre-launch floor equals CURRENT — there are no schema step functions.
 * Older local saves are unsupported; Zod defaults repair the envelope.
 */
export function migrateSaveDataToCurrent(parsed: unknown): RawSaveData {
  if (!parsed || typeof parsed !== "object") return {};
  let next = { ...(parsed as RawSaveData) };
  const contentVersion = getRawContentVersion(next);
  if (contentVersion < 2) {
    next = migrateContentV1ToV2(next) as RawSaveData;
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
