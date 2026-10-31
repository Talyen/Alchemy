import { afterEach, describe, expect, it, vi } from "vitest";
import { installDesktopApi } from "../helpers/desktop-save-mock-helper";
import {
  initializeSteamCloudSync,
  isDesktop,
  openFullGameWishlist,
  quitDesktopApp,
  setDisplayMode,
  setSteamRichPresence,
} from "@/lib/platform";

afterEach(() => {
  window.alchemyDesktop = undefined;
});

describe("desktop runtime", () => {
  it("reports desktop capability from the live bridge", () => {
    expect(isDesktop()).toBe(false);
    installDesktopApi();
    expect(isDesktop()).toBe(true);
  });

  it("delegates display mode and quit when the desktop bridge exists", async () => {
    const setMode = vi.fn().mockResolvedValue(undefined);
    const quit = vi.fn().mockResolvedValue(undefined);
    installDesktopApi({
      overrides: {
        setDisplayMode: setMode,
        quit,
      },
    });

    await setDisplayMode("fullscreen");
    quitDesktopApp();

    expect(setMode).toHaveBeenCalledWith("fullscreen");
    expect(quit).toHaveBeenCalledOnce();
  });

  it("uses harmless browser fallbacks", async () => {
    await expect(setDisplayMode("windowed")).resolves.toBeUndefined();
    expect(() => quitDesktopApp()).not.toThrow();
    expect(() => openFullGameWishlist()).not.toThrow();
    await expect(setSteamRichPresence("status", "Playing")).resolves.toBe(false);
  });

  it("delegates wishlist opening when supported by the desktop bridge", () => {
    const openWishlist = vi.fn().mockResolvedValue(true);
    installDesktopApi({
      overrides: { openWishlist },
    });
    openFullGameWishlist();
    expect(openWishlist).toHaveBeenCalledOnce();
  });

  it("returns Cloud availability instead of exposing the Steam name", async () => {
    installDesktopApi({ steamName: "PlayerOne", cloudSyncEnabled: true });

    await expect(initializeSteamCloudSync()).resolves.toBe(true);
  });

  it("honors disabled Cloud without logging the Steam name", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      installDesktopApi({ steamName: "PrivatePlayer", cloudSyncEnabled: false });
      await expect(initializeSteamCloudSync()).resolves.toBe(false);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("keeps cloud sync disabled when Steam identity is unavailable", async () => {
    const cloudProbe = vi.fn().mockResolvedValue(true);
    installDesktopApi({ overrides: { steamIsCloudEnabled: cloudProbe } });

    await expect(initializeSteamCloudSync()).resolves.toBe(false);
    expect(cloudProbe).not.toHaveBeenCalled();
  });

  it("keeps Cloud disabled when initialization fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      installDesktopApi({
        steamName: "PlayerOne",
        overrides: { steamIsCloudEnabled: vi.fn().mockRejectedValue(new Error("unavailable")) },
      });
      await expect(initializeSteamCloudSync()).resolves.toBe(false);
      expect(warn).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
  });

  it("delegates rich presence without requiring initialization state", async () => {
    const setRichPresence = vi.fn().mockResolvedValue(true);
    installDesktopApi({
      overrides: { steamSetRichPresence: setRichPresence },
    });

    await expect(setSteamRichPresence("steam_display", "#Playing")).resolves.toBe(true);
    expect(setRichPresence).toHaveBeenCalledWith("steam_display", "#Playing");
  });
});
