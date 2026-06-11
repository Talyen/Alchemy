// Picks the newer of two serialized save payloads for Steam Cloud vs local conflict resolution.
import { getRawSaveSchemaVersion } from "./migration";

function parseSave(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function saveTimestamp(parsed: Record<string, unknown>): number {
  const lastSavedAt = parsed.lastSavedAt;
  if (typeof lastSavedAt === "number" && Number.isFinite(lastSavedAt) && lastSavedAt >= 0) {
    return lastSavedAt;
  }
  return 0;
}

/** Returns the raw JSON string that should be loaded when local and cloud copies diverge. */
export function pickNewerSavePayload(localRaw: string, cloudRaw: string): string {
  const local = parseSave(localRaw);
  const cloud = parseSave(cloudRaw);
  if (!local) return cloudRaw;
  if (!cloud) return localRaw;

  const localVersion = getRawSaveSchemaVersion(local);
  const cloudVersion = getRawSaveSchemaVersion(cloud);
  if (cloudVersion > localVersion) return cloudRaw;
  if (localVersion > cloudVersion) return localRaw;

  const localTs = saveTimestamp(local);
  const cloudTs = saveTimestamp(cloud);
  if (cloudTs > localTs) return cloudRaw;
  if (localTs > cloudTs) return localRaw;

  // Legacy saves lack lastSavedAt (both 0). Prefer Steam Cloud when copies diverge.
  if (localTs === 0 && cloudTs === 0 && localRaw !== cloudRaw) {
    return cloudRaw;
  }

  return localRaw;
}
