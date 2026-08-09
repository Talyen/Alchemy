// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPlatformSaveBackend } from "@/lib/platform-save-backend";

type DesktopApi = NonNullable<Window["alchemyDesktop"]>;

function installDesktopApi(overrides: Partial<DesktopApi> = {}): DesktopApi {
  const api: DesktopApi = {
    isDesktop: true,
    setDisplayMode: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    listSaveCandidates: vi.fn().mockResolvedValue([]),
    writeSave: vi.fn().mockResolvedValue(true),
    clearSave: vi.fn().mockResolvedValue(true),
    steamGetName: vi.fn().mockResolvedValue(null),
    steamSetRichPresence: vi.fn().mockResolvedValue(false),
    steamCloudRead: vi.fn().mockResolvedValue(null),
    steamCloudWrite: vi.fn().mockResolvedValue(false),
    steamCloudDelete: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
  window.alchemyDesktop = api;
  return api;
}

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
      listSaveCandidates: vi.fn().mockResolvedValue(["primary", "backup", "primary"]),
      steamCloudRead: vi.fn().mockResolvedValue("cloud"),
    });

    await expect(createPlatformSaveBackend().readCandidates("ignored")).resolves.toEqual({
      ok: true,
      candidates: ["primary", "backup", "cloud"],
    });
  });

  it("writes desktop local before cloud and treats cloud failure as non-fatal", async () => {
    const order: string[] = [];
    installDesktopApi({
      writeSave: vi.fn().mockImplementation(async () => {
        order.push("local");
        return true;
      }),
      steamCloudWrite: vi.fn().mockImplementation(async () => {
        order.push("cloud");
        return false;
      }),
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
      clearSave,
      steamCloudDelete: vi.fn().mockResolvedValue(false),
    });

    const result = await createPlatformSaveBackend({ cloudSyncEnabled: true }).clear("ignored");
    expect(result.ok).toBe(false);
    expect(clearSave).not.toHaveBeenCalled();
  });

  it("clears cloud before the desktop backup ring", async () => {
    const order: string[] = [];
    installDesktopApi({
      steamCloudDelete: vi.fn().mockImplementation(async () => {
        order.push("cloud");
        return true;
      }),
      clearSave: vi.fn().mockImplementation(async () => {
        order.push("local");
        return true;
      }),
    });

    await expect(createPlatformSaveBackend({ cloudSyncEnabled: true }).clear("ignored")).resolves.toEqual({ ok: true });
    expect(order).toEqual(["cloud", "local"]);
  });
});
