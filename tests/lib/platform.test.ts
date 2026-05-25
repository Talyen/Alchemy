// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

beforeEach(() => {
  if (globalThis.window) {
    delete (window as any).alchemyDesktop;
  }
});

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  if (globalThis.window) {
    delete (window as any).alchemyDesktop;
  }
});

describe("platform.isDesktop", () => {
  it("is false in browser (no alchemyDesktop)", async () => {
    const { platform } = await import("@/lib/platform");
    expect(platform.isDesktop).toBe(false);
  });

  it("is true when alchemyDesktop.isDesktop is set", async () => {
    (window as any).alchemyDesktop = { isDesktop: true };
    const { platform } = await import("@/lib/platform");
    expect(platform.isDesktop).toBe(true);
  });

  it("is false when alchemyDesktop.isDesktop is missing", async () => {
    (window as any).alchemyDesktop = {};
    const { platform } = await import("@/lib/platform");
    expect(platform.isDesktop).toBe(false);
  });
});

describe("platform.canQuit", () => {
  it("is false in browser", async () => {
    const { platform } = await import("@/lib/platform");
    expect(platform.canQuit).toBe(false);
  });

  it("is true when alchemyDesktop.isDesktop is set", async () => {
    (window as any).alchemyDesktop = { isDesktop: true };
    const { platform } = await import("@/lib/platform");
    expect(platform.canQuit).toBe(true);
  });
});

describe("platform.setDisplayMode", () => {
  it("returns resolved promise in browser", async () => {
    const { platform } = await import("@/lib/platform");
    await expect(platform.setDisplayMode("windowed")).resolves.toBeUndefined();
  });

  it("calls desktop setDisplayMode when available", async () => {
    const setDisplayMode = vi.fn(() => Promise.resolve());
    (window as any).alchemyDesktop = { isDesktop: true, setDisplayMode };
    const { platform } = await import("@/lib/platform");
    await platform.setDisplayMode("fullscreen");
    expect(setDisplayMode).toHaveBeenCalledWith("fullscreen");
  });

  it("delegates all three mode strings", async () => {
    const setDisplayMode = vi.fn(() => Promise.resolve());
    (window as any).alchemyDesktop = { isDesktop: true, setDisplayMode };
    const { platform } = await import("@/lib/platform");
    await platform.setDisplayMode("windowed");
    await platform.setDisplayMode("borderless-fullscreen");
    await platform.setDisplayMode("fullscreen");
    expect(setDisplayMode).toHaveBeenCalledTimes(3);
  });
});

describe("platform.quit", () => {
  it("does not throw in browser", async () => {
    const { platform } = await import("@/lib/platform");
    expect(() => platform.quit()).not.toThrow();
  });

  it("calls desktop quit when available", async () => {
    const quit = vi.fn();
    (window as any).alchemyDesktop = { isDesktop: true, quit };
    const { platform } = await import("@/lib/platform");
    platform.quit();
    expect(quit).toHaveBeenCalled();
  });
});

describe("platform.steam", () => {
  it("does not crash and returns default values in browser", async () => {
    const { platform } = await import("@/lib/platform");
    expect(platform.steam.isInitialized).toBe(false);
    expect(platform.steam.playerName).toBeNull();
    await expect(platform.steam.unlockAchievement("ach1")).resolves.toBe(false);
    await expect(platform.steam.setRichPresence("key", "val")).resolves.toBe(false);
  });

  it("calls steamGetName on init and updates status when name is retrieved", async () => {
    const steamGetName = vi.fn(() => Promise.resolve("PlayerOne"));
    (window as any).alchemyDesktop = { isDesktop: true, steamGetName };
    const { platform } = await import("@/lib/platform");
    await platform.steam.init();
    expect(steamGetName).toHaveBeenCalled();
    expect(platform.steam.isInitialized).toBe(true);
    expect(platform.steam.playerName).toBe("PlayerOne");
  });

  it("delegates unlockAchievement to desktop bridge when available", async () => {
    const steamUnlockAchievement = vi.fn(() => Promise.resolve(true));
    (window as any).alchemyDesktop = { isDesktop: true, steamUnlockAchievement };
    const { platform } = await import("@/lib/platform");
    const result = await platform.steam.unlockAchievement("achievement_1");
    expect(steamUnlockAchievement).toHaveBeenCalledWith("achievement_1");
    expect(result).toBe(true);
  });

  it("delegates setRichPresence to desktop bridge when available", async () => {
    const steamSetRichPresence = vi.fn(() => Promise.resolve(true));
    (window as any).alchemyDesktop = { isDesktop: true, steamSetRichPresence };
    const { platform } = await import("@/lib/platform");
    const result = await platform.steam.setRichPresence("status", "Playing");
    expect(steamSetRichPresence).toHaveBeenCalledWith("status", "Playing");
    expect(result).toBe(true);
  });
});
