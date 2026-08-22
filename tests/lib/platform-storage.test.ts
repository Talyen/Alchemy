// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installDesktopApi } from "../helpers/desktop-save-mock-helper";
import { createPlatformSaveBackend } from "@/lib/platform-save-backend";

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
    vi.restoreAllMocks();
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
    expect(order).toEqual(["cloud", "local"]);
  });
});
