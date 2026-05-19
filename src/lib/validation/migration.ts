import { CURRENT_CONTENT_VERSION, CURRENT_GAME_BUILD_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "./metadata";

type RawSaveData = Record<string, unknown>;

const LEGACY_RESOLUTION_TO_ASPECT_RATIO = {
  "1920x1080": "16:9",
  "1920x1200": "16:10",
  "2560x1080": "21:9",
} as const;

function normalizeLegacyAspectRatio(parsed: RawSaveData): RawSaveData {
  if (typeof parsed.selectedAspectRatio === "string") return parsed;
  if (typeof parsed.selectedResolution !== "string") return parsed;
  const selectedAspectRatio =
    LEGACY_RESOLUTION_TO_ASPECT_RATIO[parsed.selectedResolution as keyof typeof LEGACY_RESOLUTION_TO_ASPECT_RATIO];
  return selectedAspectRatio ? { ...parsed, selectedAspectRatio } : parsed;
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) return fallback;
  return value;
}

export function getRawSaveSchemaVersion(parsed: unknown): number {
  if (!parsed || typeof parsed !== "object") return 0;
  const version = (parsed as RawSaveData).saveSchemaVersion;
  if (typeof version !== "number" || !Number.isFinite(version) || !Number.isInteger(version) || version < 0) return 0;
  return version;
}

function migrateV0ToV1(parsed: RawSaveData): RawSaveData {
  return {
    ...parsed,
    saveSchemaVersion: 1,
    gameBuildVersion:
      typeof parsed.gameBuildVersion === "string" ? parsed.gameBuildVersion : CURRENT_GAME_BUILD_VERSION,
    contentVersion: normalizePositiveInteger(parsed.contentVersion, CURRENT_CONTENT_VERSION),
  };
}

export function migrateSaveDataToCurrent(parsed: unknown): RawSaveData {
  if (!parsed || typeof parsed !== "object") return {};
  let current = { ...(parsed as RawSaveData) };
  let version = getRawSaveSchemaVersion(current);
  if (version < 1) {
    current = migrateV0ToV1(current);
    version = 1;
  }
  return normalizeLegacyAspectRatio({ ...current, saveSchemaVersion: version });
}

export function isUnsupportedFutureSaveData(parsed: unknown): boolean {
  return getRawSaveSchemaVersion(parsed) > CURRENT_SAVE_SCHEMA_VERSION;
}
