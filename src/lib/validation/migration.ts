// Schema version migration for raw localStorage payloads.
// Runs as a Zod preprocess inside SaveDataSchema — this IS the production migration path.
// Depends on: metadata.ts (version constants). Used by: save-schemas.ts (SaveDataSchema).
// Adding a new migration: increment CURRENT_SAVE_SCHEMA_VERSION in metadata.ts and add a
// migrateVNToVNPlus1 function chained inside migrateSaveDataToCurrent.
import { CURRENT_CONTENT_VERSION, CURRENT_GAME_BUILD_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "./metadata";

type RawSaveData = Record<string, unknown>;

// Maps old fixed-resolution strings (v0 save format) to the canonical aspect-ratio values
// used in v1+. Only runs after schema migration so the field is already at its new name.
const LEGACY_RESOLUTION_TO_ASPECT_RATIO = {
  "1920x1080": "16:9",
  "1920x1200": "16:10",
  "2560x1080": "21:9",
} as const;

// Converts persisted selectedResolution → selectedAspectRatio for saves predating the v1
// aspect-ratio picker. If neither field is a string the save is left unchanged (Zod .catch
// will supply the "auto" default during parsing).
function normalizeLegacyAspectRatio(parsed: RawSaveData): RawSaveData {
  if (typeof parsed.selectedAspectRatio === "string") return parsed;
  if (typeof parsed.selectedResolution !== "string") return parsed;
  const selectedAspectRatio =
    LEGACY_RESOLUTION_TO_ASPECT_RATIO[parsed.selectedResolution as keyof typeof LEGACY_RESOLUTION_TO_ASPECT_RATIO];
  return selectedAspectRatio ? { ...parsed, selectedAspectRatio } : parsed;
}

// Used only within migration steps — Zod handles per-field clamping on the parsed output.
function normalizePositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) return fallback;
  return value;
}

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

function remapArrowKeywordProgress(record: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!record || typeof record !== "object") return {};
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === "arrow") continue;
    next[key] = value;
  }
  if ("arrow" in record) {
    const archeryValue = record.archery;
    const arrowValue = record.arrow;
    if (typeof archeryValue === "number" && typeof arrowValue === "number") {
      next.archery = archeryValue + arrowValue;
    } else if (archeryValue !== undefined) {
      next.archery = archeryValue;
    } else if (arrowValue !== undefined) {
      next.archery = arrowValue;
    }
  }
  return next;
}

function remapArrowTalentId(id: string): string {
  if (id === "arrow-damage") return "archery-damage";
  const placeholderMatch = /^arrow-placeholder-(\d+)$/.exec(id);
  if (placeholderMatch) return `archery-placeholder-${placeholderMatch[1]}`;
  if (id.startsWith("arrow-")) return `archery-${id.slice("arrow-".length)}`;
  return id;
}

function remapArrowUnlockedTalents(record: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!record || typeof record !== "object") return {};
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === "arrow") continue;
    next[key] = value;
  }
  const arrowIds = record.arrow;
  const archeryIds = record.archery;
  const mergedIds = [
    ...(Array.isArray(archeryIds) ? archeryIds : []),
    ...(Array.isArray(arrowIds)
      ? arrowIds.filter((id): id is string => typeof id === "string").map(remapArrowTalentId)
      : []),
  ];
  if (mergedIds.length > 0) {
    next.archery = Array.from(new Set(mergedIds.filter((id): id is string => typeof id === "string")));
  }
  return next;
}

function migrateV1ToV2(parsed: RawSaveData): RawSaveData {
  return {
    ...parsed,
    saveSchemaVersion: 2,
    talentXP: remapArrowKeywordProgress(parsed.talentXP as Record<string, unknown> | undefined),
    unlockedTalents: remapArrowUnlockedTalents(parsed.unlockedTalents as Record<string, unknown> | undefined),
    runTalentXP:
      parsed.runTalentXP !== undefined
        ? remapArrowKeywordProgress(parsed.runTalentXP as Record<string, unknown> | undefined)
        : parsed.runTalentXP,
  };
}

// V0 saves predate schema-version tracking; they lack gameBuildVersion and contentVersion.
function migrateV0ToV1(parsed: RawSaveData): RawSaveData {
  return {
    ...parsed,
    saveSchemaVersion: 1,
    gameBuildVersion:
      typeof parsed.gameBuildVersion === "string" ? parsed.gameBuildVersion : CURRENT_GAME_BUILD_VERSION,
    contentVersion: normalizePositiveInteger(parsed.contentVersion, CURRENT_CONTENT_VERSION),
  };
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
