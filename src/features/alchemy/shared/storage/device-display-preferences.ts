import { DEFAULT_DEVICE_DISPLAY, normalizeDisplayPercent, type DeviceDisplayPreferences } from "@/lib/settings-values";

export const DEVICE_DISPLAY_STORAGE_KEY = "alchemy-device-display-v1";

export function readDeviceDisplayPreferences(): DeviceDisplayPreferences {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(DEVICE_DISPLAY_STORAGE_KEY) ?? "null");
    if (!saved || typeof saved !== "object" || !("version" in saved) || saved.version !== 1) {
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
  } catch {
    return { ...DEFAULT_DEVICE_DISPLAY };
  }
}

export function writeDeviceDisplayPreferences({ gameSizePercent, tooltipSizePercent }: DeviceDisplayPreferences) {
  try {
    localStorage.setItem(
      DEVICE_DISPLAY_STORAGE_KEY,
      JSON.stringify({ version: 1, gameSizePercent, tooltipSizePercent }),
    );
  } catch {
    return;
  }
}
