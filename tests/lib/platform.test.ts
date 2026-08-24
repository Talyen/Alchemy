// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { installDesktopApi } from "../helpers/desktop-save-mock-helper";
import { initializeSteam, isDesktop, quitDesktopApp, setDisplayMode, setSteamRichPresence } from "@/lib/platform";

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
    await expect(setSteamRichPresence("status", "Playing")).resolves.toBe(false);
  });

  it("returns Steam capabilities instead of mutating shared state", async () => {
    installDesktopApi({ steamName: "PlayerOne" });

    await expect(initializeSteam()).resolves.toEqual({
      playerName: "PlayerOne",
      cloudSyncEnabled: true,
    });
  });

  it("keeps cloud sync disabled when Steam identity is unavailable", async () => {
    installDesktopApi();

    await expect(initializeSteam()).resolves.toEqual({
      playerName: null,
      cloudSyncEnabled: false,
    });
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
