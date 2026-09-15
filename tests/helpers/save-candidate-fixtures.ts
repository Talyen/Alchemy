import { CURRENT_CONTENT_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";

// Canonical minimal candidate builders for save load-path tests. Production
// load uses evaluateSaveCandidates; these helpers keep unit (save-version-
// protection) and integration (storage-io, roundtrip) fixtures aligned without
// duplicating envelope shapes.
export function playableSaveCandidate(lastSavedAt: number, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    contentVersion: CURRENT_CONTENT_VERSION,
    lastSavedAt,
    discoveredCardIds: ["slash"],
    activeRun: null,
    ...overrides,
  });
}

export function futureSaveCandidate(lastSavedAt: number | undefined, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1,
    contentVersion: CURRENT_CONTENT_VERSION,
    ...(lastSavedAt === undefined ? {} : { lastSavedAt }),
    discoveredCardIds: ["slash"],
    activeRun: null,
    ...overrides,
  });
}

export function futureContentSaveCandidate(
  lastSavedAt: number | undefined,
  overrides: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    contentVersion: CURRENT_CONTENT_VERSION + 1,
    ...(lastSavedAt === undefined ? {} : { lastSavedAt }),
    discoveredCardIds: ["slash"],
    activeRun: null,
    ...overrides,
  });
}
