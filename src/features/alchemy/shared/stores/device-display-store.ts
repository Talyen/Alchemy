import { readDeviceDisplayPreferences, writeDeviceDisplayPreferences } from "../storage/device-display-preferences";
import { create } from "zustand";
import { DEFAULT_DEVICE_DISPLAY, normalizeDisplayPercent, type DeviceDisplayPreferences } from "@/lib/settings-values";

interface DeviceDisplayStore extends DeviceDisplayPreferences {
  setGameSizePercent: (value: number) => void;
  setTooltipSizePercent: (value: number) => void;
  resetSizes: () => void;
}

export const useDeviceDisplayStore = create<DeviceDisplayStore>((set) => ({
  ...readDeviceDisplayPreferences(),
  setGameSizePercent: (value) => set({ gameSizePercent: normalizeDisplayPercent("gameSizePercent", value) }),
  setTooltipSizePercent: (value) => set({ tooltipSizePercent: normalizeDisplayPercent("tooltipSizePercent", value) }),
  resetSizes: () => set({ ...DEFAULT_DEVICE_DISPLAY }),
}));

useDeviceDisplayStore.subscribe(writeDeviceDisplayPreferences);
