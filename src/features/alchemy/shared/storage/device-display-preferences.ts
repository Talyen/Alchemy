import { DEFAULT_DEVICE_DISPLAY, normalizeDisplayPercent, type DeviceDisplayPreferences } from "@/lib/settings-values";

export const DEVICE_DISPLAY_STORAGE_KEY = "alchemy-device-display-v1";
const DEVICE_DISPLAY_STORAGE_VERSION = 1;

function readStoredPreferences(): DeviceDisplayPreferences {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return { ...DEFAULT_DEVICE_DISPLAY };
  let saved: unknown;
  try {
    saved = JSON.parse(localStorage.getItem(DEVICE_DISPLAY_STORAGE_KEY) ?? "null") as unknown;
  } catch {
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
  } catch {
    return { ...DEFAULT_DEVICE_DISPLAY };
  }
}

export function writeDeviceDisplayPreferences({ gameSizePercent, tooltipSizePercent }: DeviceDisplayPreferences) {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      DEVICE_DISPLAY_STORAGE_KEY,
      JSON.stringify({ version: DEVICE_DISPLAY_STORAGE_VERSION, gameSizePercent, tooltipSizePercent }),
    );
  } catch {
    return;
  }
}
