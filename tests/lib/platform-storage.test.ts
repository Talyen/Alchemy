import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installDesktopApi } from "../helpers/desktop-save-mock-helper";
import { SAVE_KEY, SAVE_RECOVERY_KEY } from "@/lib/game-constants";
import {
  createBrowserSaveBackend,
  createDesktopSaveBackend,
  createPlatformSaveBackend,
} from "@/lib/platform-save-backend";

function createMockStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
}

describe("platform save backend", () => {
  const originalLocalStorage = window.localStorage;

  beforeEach(() => {
    window.alchemyDesktop = undefined;
    Object.defineProperty(window, "localStorage", {
      value: createMockStorage(),
      configurable: true,
    });
  });

  afterEach(() => {
    window.alchemyDesktop = undefined;
    Object.defineProperty(window, "localStorage", {
      value: originalLocalStorage,
      configurable: true,
    });
  });

  it("reads, writes, and clears browser storage", async () => {
    const backend = createPlatformSaveBackend();

    await expect(backend.write("alchemy-test", '{"ok":true}')).resolves.toEqual({ ok: true });
    await expect(backend.readCandidates("alchemy-test")).resolves.toEqual({
      ok: true,
      candidates: ['{"ok":true}'],
    });
    await expect(backend.clear("alchemy-test")).resolves.toEqual({ ok: true });
    await expect(backend.readCandidates("alchemy-test")).resolves.toEqual({ ok: true, candidates: [] });
  });

  it("clears the recovery copy with a normal browser progress wipe", async () => {
    const backend = createBrowserSaveBackend();
    await backend.write(SAVE_KEY, "primary");
    await backend.write(SAVE_RECOVERY_KEY, "recovery");

    await expect(backend.clear(SAVE_KEY)).resolves.toEqual({ ok: true });
    await expect(backend.readCandidates(SAVE_KEY)).resolves.toEqual({ ok: true, candidates: [] });
    await expect(backend.readCandidates(SAVE_RECOVERY_KEY)).resolves.toEqual({ ok: true, candidates: [] });
  });

  it("orders desktop primary, backups, then cloud and deduplicates payloads", async () => {
    installDesktopApi({
      saveCandidates: ["primary", "backup", "primary"],
      overrides: { steamCloudRead: vi.fn().mockResolvedValue("cloud") },
    });

    await expect(createPlatformSaveBackend().readCandidates("ignored")).resolves.toEqual({
      ok: true,
      candidates: ["primary", "backup", "cloud"],
    });
  });

  it("uses Cloud when the local save cannot be read and marks the main slot unsafe", async () => {
    const error = new Error("local read failed");
    const cloudRead = vi.fn().mockResolvedValue("cloud");
    installDesktopApi({
      overrides: {
        readSaveSlot: vi.fn().mockRejectedValue(error),
        steamCloudRead: cloudRead,
      },
    });

    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(createPlatformSaveBackend({ cloudSyncEnabled: true }).readCandidates("ignored")).resolves.toEqual({
      ok: true,
      candidates: ["cloud"],
      localReadFailed: true,
    });
    expect(cloudRead).toHaveBeenCalledOnce();
    vi.mocked(console.error).mockRestore();
  });

  it("keeps readable backups when another local candidate cannot be read", async () => {
    installDesktopApi({
      overrides: {
        readSaveSlot: vi.fn().mockResolvedValue({ candidates: ["backup"], localReadFailed: true }),
      },
    });

    await expect(createDesktopSaveBackend().readCandidates(SAVE_KEY)).resolves.toEqual({
      ok: true,
      candidates: ["backup"],
      localReadFailed: true,
    });
  });

  it("routes recovery reads and writes to the separate desktop and Cloud slot", async () => {
    const desktop = installDesktopApi({ recoveryCandidates: ["local-recovery"] });
    await expect(
      createDesktopSaveBackend({ cloudSyncEnabled: true }).readCandidates(SAVE_RECOVERY_KEY),
    ).resolves.toEqual({
      ok: true,
      candidates: ["local-recovery"],
    });
    await expect(
      createDesktopSaveBackend({ cloudSyncEnabled: true }).write(SAVE_RECOVERY_KEY, "new-recovery"),
    ).resolves.toEqual({
      ok: true,
    });
    expect(desktop.readSaveSlot).toHaveBeenCalledWith("recovery");
    expect(desktop.writeSave).toHaveBeenCalledWith("new-recovery", "recovery");
    expect(desktop.steamCloudWrite).toHaveBeenCalledWith("new-recovery", "recovery");
  });

  it("tries the recovery Cloud slot when the local recovery file cannot be written", async () => {
    const desktop = installDesktopApi({
      overrides: { writeSave: vi.fn().mockResolvedValue(false) },
    });

    await expect(
      createDesktopSaveBackend({ cloudSyncEnabled: true }).write(SAVE_RECOVERY_KEY, "new-recovery"),
    ).resolves.toEqual({
      ok: false,
      error: expect.any(Error),
    });
    expect(desktop.steamCloudWrite).toHaveBeenCalledWith("new-recovery", "recovery");
  });

  it("writes desktop local before cloud and treats cloud failure as non-fatal", async () => {
    const order: string[] = [];
    installDesktopApi({
      overrides: {
        writeSave: vi.fn().mockImplementation(async () => {
          order.push("local");
          return true;
        }),
        steamCloudWrite: vi.fn().mockImplementation(async () => {
          order.push("cloud");
          return false;
        }),
      },
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(createPlatformSaveBackend({ cloudSyncEnabled: true }).write("ignored", "payload")).resolves.toEqual({
      ok: true,
    });
    expect(order).toEqual(["local", "cloud"]);
  });

  it("fails closed without clearing local data when cloud deletion fails", async () => {
    const clearSave = vi.fn().mockResolvedValue(true);
    installDesktopApi({
      overrides: {
        clearSave,
        steamCloudDelete: vi.fn().mockResolvedValue(false),
      },
    });

    const result = await createPlatformSaveBackend({ cloudSyncEnabled: true }).clear("ignored");
    expect(result.ok).toBe(false);
    expect(clearSave).not.toHaveBeenCalled();
  });

  it("clears cloud before the desktop backup ring", async () => {
    const order: string[] = [];
    installDesktopApi({
      overrides: {
        steamCloudDelete: vi.fn().mockImplementation(async () => {
          order.push("cloud");
          return true;
        }),
        clearSave: vi.fn().mockImplementation(async () => {
          order.push("local");
          return true;
        }),
      },
    });

    await expect(createPlatformSaveBackend({ cloudSyncEnabled: true }).clear("ignored")).resolves.toEqual({ ok: true });
    expect(order).toEqual(["cloud", "cloud", "local"]);
  });

  it("wipes local even when cloud deletion fails when forceLocalWipe is set", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const order: string[] = [];
    installDesktopApi({
      overrides: {
        steamCloudDelete: vi.fn().mockImplementation(async () => {
          order.push("cloud");
          return false;
        }),
        clearSave: vi.fn().mockImplementation(async () => {
          order.push("local");
          return true;
        }),
      },
    });

    await expect(
      createPlatformSaveBackend({ cloudSyncEnabled: true }).clear("ignored", { forceLocalWipe: true }),
    ).resolves.toEqual({ ok: true });
    expect(order).toEqual(["local", "cloud", "cloud"]);
    vi.mocked(console.warn).mockRestore();
  });

  it("defers desktop exit flushes to the async queue", () => {
    installDesktopApi({});
    expect(createDesktopSaveBackend().writeSync("ignored", "payload")).toBeNull();
  });

  it("reports desktop unavailability instead of throwing when used directly", async () => {
    window.alchemyDesktop = undefined;
    const backend = createDesktopSaveBackend();
    await expect(backend.readCandidates("ignored")).resolves.toEqual({ ok: false, error: expect.anything() });
    await expect(backend.write("ignored", "payload")).resolves.toEqual({ ok: false, error: expect.anything() });
    // Sync writes always defer to the async queue on desktop, even without an API.
    expect(backend.writeSync("ignored", "payload")).toBeNull();
    await expect(backend.clear("ignored")).resolves.toEqual({ ok: false, error: expect.anything() });
  });

  it("reports browser storage failure instead of throwing without browser globals", async () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("localStorage", undefined);
    try {
      const backend = createBrowserSaveBackend();
      await expect(backend.readCandidates("ignored")).resolves.toEqual({ ok: false, error: expect.anything() });
      await expect(backend.write("ignored", "payload")).resolves.toEqual({ ok: false, error: expect.anything() });
      expect(backend.writeSync("ignored", "payload")).toEqual({ ok: false, error: expect.anything() });
      await expect(backend.clear("ignored")).resolves.toEqual({ ok: false, error: expect.anything() });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
