import { settingsPersistenceCodec } from "@/features/alchemy/shared/stores/settings-store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEVICE_DISPLAY_STORAGE_KEY,
  readDeviceDisplayPreferences,
  writeDeviceDisplayPreferences,
} from "@/features/alchemy/shared/storage/device-display-preferences";
import { useDeviceDisplayStore } from "@/features/alchemy/shared/stores/device-display-store";

describe("device display preferences", () => {
  beforeEach(() => {
    localStorage.removeItem(DEVICE_DISPLAY_STORAGE_KEY);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    useDeviceDisplayStore.getState().resetSizes();
  });
  it("defaults independently and validates saved values", () => {
    expect(readDeviceDisplayPreferences()).toEqual({ gameSizePercent: 100, tooltipSizePercent: 100 });
    localStorage.setItem(
      DEVICE_DISPLAY_STORAGE_KEY,
      JSON.stringify({ version: 1, gameSizePercent: 87, tooltipSizePercent: "large" }),
    );
    expect(readDeviceDisplayPreferences()).toEqual({ gameSizePercent: 85, tooltipSizePercent: 100 });
    localStorage.setItem(DEVICE_DISPLAY_STORAGE_KEY, "broken");
    expect(readDeviceDisplayPreferences().gameSizePercent).toBe(100);
  });
  it("persists separately and resets both preferences", () => {
    useDeviceDisplayStore.getState().setGameSizePercent(85);
    useDeviceDisplayStore.getState().setTooltipSizePercent(120);
    expect(readDeviceDisplayPreferences()).toEqual({ gameSizePercent: 85, tooltipSizePercent: 120 });
    useDeviceDisplayStore.getState().resetSizes();
    expect(readDeviceDisplayPreferences()).toEqual({ gameSizePercent: 100, tooltipSizePercent: 100 });
  });
  it("does not export preferences or overwrite them when a game save is hydrated", () => {
    useDeviceDisplayStore.getState().setGameSizePercent(85);
    const saved = settingsPersistenceCodec.encode();
    expect(saved).not.toHaveProperty("gameSizePercent");
    expect(saved).not.toHaveProperty("tooltipSizePercent");
    settingsPersistenceCodec.hydrate(settingsPersistenceCodec.createDefault());
    expect(useDeviceDisplayStore.getState().gameSizePercent).toBe(85);
  });
  it("continues in memory when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("unavailable");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("unavailable");
    });
    expect(readDeviceDisplayPreferences().tooltipSizePercent).toBe(100);
    expect(() => writeDeviceDisplayPreferences({ gameSizePercent: 80, tooltipSizePercent: 125 })).not.toThrow();
    useDeviceDisplayStore.getState().setGameSizePercent(80);
    expect(useDeviceDisplayStore.getState().gameSizePercent).toBe(80);
  });
});
