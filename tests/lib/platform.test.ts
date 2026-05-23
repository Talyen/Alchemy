// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

beforeEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("platform.isDesktop", () => {
  it("is false in browser (no alchemyDesktop)", async () => {
    (globalThis as Record<string, unknown>).window = {} as Window & typeof globalThis;
    const { platform } = await import("@/lib/platform");
    expect(platform.isDesktop).toBe(false);
  });

  it("is true when alchemyDesktop.isDesktop is set", async () => {
    (globalThis as Record<string, unknown>).window = {
      alchemyDesktop: { isDesktop: true },
    } as unknown as Window & typeof globalThis;
    const { platform } = await import("@/lib/platform");
    expect(platform.isDesktop).toBe(true);
  });

  it("is false when alchemyDesktop.isDesktop is missing", async () => {
    (globalThis as Record<string, unknown>).window = {
      alchemyDesktop: {},
    } as unknown as Window & typeof globalThis;
    const { platform } = await import("@/lib/platform");
    expect(platform.isDesktop).toBe(false);
  });
});

describe("platform.canQuit", () => {
  it("is false in browser", async () => {
    (globalThis as Record<string, unknown>).window = {} as Window & typeof globalThis;
    const { platform } = await import("@/lib/platform");
    expect(platform.canQuit).toBe(false);
  });

  it("is true when alchemyDesktop.isDesktop is set", async () => {
    (globalThis as Record<string, unknown>).window = {
      alchemyDesktop: { isDesktop: true },
    } as unknown as Window & typeof globalThis;
    const { platform } = await import("@/lib/platform");
    expect(platform.canQuit).toBe(true);
  });
});

describe("platform.setDisplayMode", () => {
  it("returns resolved promise in browser", async () => {
    (globalThis as Record<string, unknown>).window = {} as Window & typeof globalThis;
    const { platform } = await import("@/lib/platform");
    await expect(platform.setDisplayMode("windowed")).resolves.toBeUndefined();
  });

  it("calls desktop setDisplayMode when available", async () => {
    const setDisplayMode = vi.fn(() => Promise.resolve());
    (globalThis as Record<string, unknown>).window = {
      alchemyDesktop: { isDesktop: true, setDisplayMode },
    } as unknown as Window & typeof globalThis;
    const { platform } = await import("@/lib/platform");
    await platform.setDisplayMode("fullscreen");
    expect(setDisplayMode).toHaveBeenCalledWith("fullscreen");
  });

  it("delegates all three mode strings", async () => {
    const setDisplayMode = vi.fn(() => Promise.resolve());
    (globalThis as Record<string, unknown>).window = {
      alchemyDesktop: { isDesktop: true, setDisplayMode },
    } as unknown as Window & typeof globalThis;
    const { platform } = await import("@/lib/platform");
    await platform.setDisplayMode("windowed");
    await platform.setDisplayMode("borderless-fullscreen");
    await platform.setDisplayMode("fullscreen");
    expect(setDisplayMode).toHaveBeenCalledTimes(3);
  });
});

describe("platform.quit", () => {
  it("does not throw in browser", async () => {
    (globalThis as Record<string, unknown>).window = {} as Window & typeof globalThis;
    const { platform } = await import("@/lib/platform");
    expect(() => platform.quit()).not.toThrow();
  });

  it("calls desktop quit when available", async () => {
    const quit = vi.fn();
    (globalThis as Record<string, unknown>).window = {
      alchemyDesktop: { isDesktop: true, quit },
    } as unknown as Window & typeof globalThis;
    const { platform } = await import("@/lib/platform");
    platform.quit();
    expect(quit).toHaveBeenCalled();
  });
});
