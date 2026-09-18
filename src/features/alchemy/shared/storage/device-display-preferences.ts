import { DEFAULT_DEVICE_DISPLAY, normalizeDisplayPercent, type DeviceDisplayPreferences } from "@/lib/settings-values";
import { isStorageUnavailable, tryLocalStorageGetItem, tryLocalStorageSetItem } from "@/lib/storage-environment";
import { logStorageFailure } from "@/lib/storage-logging";

export const DEVICE_DISPLAY_STORAGE_KEY = "alchemy-device-display-v1";
const DEVICE_DISPLAY_STORAGE_VERSION = 1;

export function readDeviceDisplayPreferences(): DeviceDisplayPreferences {
  try {
    const stored = tryLocalStorageGetItem(DEVICE_DISPLAY_STORAGE_KEY);
    if (!stored.ok) {
      // Unavailable storage (SSR/test-node) stays silent like a version
      // mismatch; only real read failures are logged.
      if (!isStorageUnavailable(stored.error)) {
        logStorageFailure("Device display preferences could not be read, using defaults", stored.error);
      }
      return { ...DEFAULT_DEVICE_DISPLAY };
    }
    let saved: unknown;
    try {
      saved = JSON.parse(stored.value ?? "null") as unknown;
    } catch (error) {
      logStorageFailure("Device display preferences could not be parsed, using defaults", error);
      return { ...DEFAULT_DEVICE_DISPLAY };
    }
    if (
      !saved ||
      typeof saved !== "object" ||
      !("version" in saved) ||
      saved.version !== DEVICE_DISPLAY_STORAGE_VERSION
    ) {
      return { ...DEFAULT_DEVICE_DISPLAY };
    }
    return {
      gameSizePercent: normalizeDisplayPercent(
        "gameSizePercent",
        "gameSizePercent" in saved ? saved.gameSizePercent : undefined,
      ),
      tooltipSizePercent: normalizeDisplayPercent(
        "tooltipSizePercent",
        "tooltipSizePercent" in saved ? saved.tooltipSizePercent : undefined,
      ),
    };
  } catch (error) {
    logStorageFailure("Device display preferences could not be read, using defaults", error);
    return { ...DEFAULT_DEVICE_DISPLAY };
  }
}

export function writeDeviceDisplayPreferences({ gameSizePercent, tooltipSizePercent }: DeviceDisplayPreferences) {
  const stored = tryLocalStorageSetItem(
    DEVICE_DISPLAY_STORAGE_KEY,
    JSON.stringify({ version: DEVICE_DISPLAY_STORAGE_VERSION, gameSizePercent, tooltipSizePercent }),
  );
  if (!stored.ok) {
    if (isStorageUnavailable(stored.error)) return;
    logStorageFailure("Device display preferences could not be saved", stored.error);
  }
}
