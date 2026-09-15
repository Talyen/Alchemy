import { DEFAULT_DEVICE_DISPLAY, normalizeDisplayPercent, type DeviceDisplayPreferences } from "@/lib/settings-values";
import { isLocalStorageAvailable, tryLocalStorageGetItem, tryLocalStorageSetItem } from "@/lib/storage-environment";
import { logStorageFailure } from "@/lib/storage-logging";

export const DEVICE_DISPLAY_STORAGE_KEY = "alchemy-device-display-v1";
const DEVICE_DISPLAY_STORAGE_VERSION = 1;

function readStoredPreferences(): DeviceDisplayPreferences {
  if (!isLocalStorageAvailable()) return { ...DEFAULT_DEVICE_DISPLAY };
  const stored = tryLocalStorageGetItem(DEVICE_DISPLAY_STORAGE_KEY);
  if (!stored.ok) {
    logStorageFailure("Device display preferences could not be read, using defaults", stored.error);
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
}

export function readDeviceDisplayPreferences(): DeviceDisplayPreferences {
  try {
    return readStoredPreferences();
  } catch (error) {
    logStorageFailure("Device display preferences could not be read, using defaults", error);
    return { ...DEFAULT_DEVICE_DISPLAY };
  }
}

export function writeDeviceDisplayPreferences({ gameSizePercent, tooltipSizePercent }: DeviceDisplayPreferences) {
  if (!isLocalStorageAvailable()) return;
  const stored = tryLocalStorageSetItem(
    DEVICE_DISPLAY_STORAGE_KEY,
    JSON.stringify({ version: DEVICE_DISPLAY_STORAGE_VERSION, gameSizePercent, tooltipSizePercent }),
  );
  if (!stored.ok) {
    logStorageFailure("Device display preferences could not be saved", stored.error);
  }
}
