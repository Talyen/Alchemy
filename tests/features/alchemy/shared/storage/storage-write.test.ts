import {
  bootstrapAlchemySaveState,
  clearAlchemySaveData,
  loadAlchemySaveState,
  saveAlchemySaveData,
  saveAlchemySaveDataForExit,
} from "@/features/alchemy/shared/storage";
import { defaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { configureSaveBackend, serializeSaveSnapshot } from "@/features/alchemy/shared/storage/io";
import type { SaveData } from "@/features/alchemy/shared/storage/types";
import { SAVE_KEY } from "@/lib/game-constants";
import { CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currentSchemaCampaignSave } from "../../../../fixtures/current-saves";
import {
  setupMockWindowBrowser,
  setupMockWindowDesktop,
  teardownMockWindow,
} from "../../../../helpers/desktop-save-mock-helper";
import { installStorageIoTestHooks } from "../../../../helpers/storage-io-test-setup";

const globalWithWindow = globalThis as unknown as { window?: object };
const mockStorage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
} as Storage;

installStorageIoTestHooks();

describe("storage io", () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    setupMockWindowBrowser(mockLocalStorage);
  });

  afterEach(() => {
    teardownMockWindow();
  });

  it("saveAlchemySaveData writes to localStorage", async () => {
    const data: SaveData = { ...defaultSaveData, selectedAspectRatio: "16:9" };
    expect(await saveAlchemySaveData(data)).toBe("saved");
    const written = JSON.parse(mockStorage[SAVE_KEY]) as SaveData;
    expect(written.selectedAspectRatio).toBe("16:9");
    expect(written.lastSavedAt).toBeGreaterThan(0);
  });

  it("stamps one lastSavedAt per physical write so exit divergence is pinnable", () => {
    const { lastSavedAt: _dropped, ...snapshot } = defaultSaveData;
    expect(JSON.parse(serializeSaveSnapshot(snapshot, 1000)).lastSavedAt).toBe(1000);
    expect(JSON.parse(serializeSaveSnapshot(snapshot, 2000)).lastSavedAt).toBe(2000);
  });

  it.each(["reported", "thrown"])("returns failed for a %s backend write failure", async (failure) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("disk unavailable");
    configureSaveBackend({
      readCandidates: async () => ({ ok: true, candidates: [] }),
      write: async () => {
        if (failure === "thrown") throw error;
        return { ok: false, error };
      },
      writeSync: () => null,
      clear: async () => ({ ok: true }),
    });
    expect(await saveAlchemySaveData(defaultSaveData)).toBe("failed");
    expect(vi.mocked(console.error).mock.calls[0]?.[0]).toContain("Save data could not be written");
  });

  it("reports serialization failure without invoking the backend", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const write = vi.fn();
    configureSaveBackend({
      readCandidates: async () => ({ ok: true, candidates: [] }),
      write,
      writeSync: () => null,
      clear: async () => ({ ok: true }),
    });
    const data = {
      ...defaultSaveData,
      toJSON: () => {
        throw new Error("serialization");
      },
    };
    expect(await saveAlchemySaveData(data)).toBe("failed");
    expect(await saveAlchemySaveDataForExit(data)).toBe("failed");
    expect(write).not.toHaveBeenCalled();
  });

  it.each([true, false])("desktop exit completion reports local success=%s only after writing", async (ok) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let release!: (result: { ok: true } | { ok: false; error: string }) => void;
    const gate = new Promise<{ ok: true } | { ok: false; error: string }>((resolve) => {
      release = resolve;
    });
    configureSaveBackend({
      readCandidates: async () => ({ ok: true, candidates: [] }),
      write: () => gate,
      writeSync: () => null,
      clear: async () => ({ ok: true }),
    });
    const completion = saveAlchemySaveDataForExit(defaultSaveData);
    expect(completion).toBeInstanceOf(Promise);
    let completed = false;
    void Promise.resolve(completion).then(() => {
      completed = true;
    });
    await Promise.resolve();
    expect(completed).toBe(false);
    release(ok ? { ok: true } : { ok: false, error: "disk" });
    expect(await completion).toBe(ok ? "saved" : "failed");
  });

  it("terminal browser flush supersedes a queued stale snapshot", async () => {
    const pending = saveAlchemySaveData({ ...defaultSaveData, discoveredCardIds: ["stale"] });

    await saveAlchemySaveDataForExit({ ...defaultSaveData, discoveredCardIds: ["latest"] });
    await pending;

    expect(JSON.parse(mockStorage[SAVE_KEY]).discoveredCardIds).toEqual(["latest"]);
  });

  it("desktop exit flush wins over an async write that is already in flight", async () => {
    const storage: Record<string, string> = {};
    let releaseWrite: (() => void) | undefined;
    const writeGate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    configureSaveBackend({
      readCandidates: async () => ({ ok: true, candidates: [] }),
      write: async (_key, value) => {
        await writeGate;
        storage[SAVE_KEY] = value;
        return { ok: true };
      },
      clear: async () => ({ ok: true }),
      writeSync: (_key, value) => {
        storage[SAVE_KEY] = value;
        return { ok: true };
      },
    });

    const pending = saveAlchemySaveData({ ...defaultSaveData, discoveredCardIds: ["stale"] });
    await Promise.resolve();
    await Promise.resolve();

    const exit = saveAlchemySaveDataForExit({ ...defaultSaveData, discoveredCardIds: ["latest"] });
    releaseWrite?.();
    await Promise.all([pending, exit]);

    expect(JSON.parse(storage[SAVE_KEY]).discoveredCardIds).toEqual(["latest"]);
  });

  it("skips terminal exit save while a clear is in flight", async () => {
    let releaseClear: (() => void) | undefined;
    const clearGate = new Promise<void>((resolve) => {
      releaseClear = resolve;
    });
    const writeSync = vi.fn().mockReturnValue({ ok: true });
    configureSaveBackend({
      readCandidates: async () => ({ ok: true, candidates: [] }),
      write: async () => ({ ok: true }),
      clear: async () => {
        await clearGate;
        return { ok: true };
      },
      writeSync,
    });

    const pendingClear = clearAlchemySaveData();
    await Promise.resolve();
    await expect(saveAlchemySaveDataForExit({ ...defaultSaveData, discoveredCardIds: ["resurrect"] })).resolves.toBe(
      "skipped",
    );
    expect(writeSync).not.toHaveBeenCalled();
    releaseClear?.();
    await pendingClear;
  });

  it("clearAlchemySaveData removes key from localStorage", async () => {
    mockStorage[SAVE_KEY] = "some-data";
    await expect(clearAlchemySaveData()).resolves.toBe(true);
    expect(mockStorage[SAVE_KEY]).toBeUndefined();
  });

  it("storage operations tolerate unavailable localStorage", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    globalWithWindow.window = {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
        removeItem: () => {
          throw new Error("blocked");
        },
      } as unknown as Storage,
    };

    expect((await loadAlchemySaveState()).data).toEqual(defaultSaveData);
    await expect(saveAlchemySaveData(defaultSaveData)).resolves.toBe("failed");
    await expect(clearAlchemySaveData()).resolves.not.toThrow();
  });

  it("coalesces overlapping saveAlchemySaveData writes to the latest snapshot", async () => {
    let releaseFirstWrite: (() => void) | undefined;
    const firstWriteGate = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    const writePayloads: string[] = [];
    let inFlightWrites = 0;
    let maxInFlightWrites = 0;

    const desktop = setupMockWindowDesktop({ saveCandidates: [], steamName: null });
    desktop.writeSave.mockImplementation(async (payload: string) => {
      inFlightWrites += 1;
      maxInFlightWrites = Math.max(maxInFlightWrites, inFlightWrites);
      writePayloads.push(payload);
      if (writePayloads.length === 1) await firstWriteGate;
      inFlightWrites -= 1;
      return true;
    });

    const first = saveAlchemySaveData({ ...defaultSaveData, discoveredCardIds: ["first"] });

    await Promise.resolve();
    await Promise.resolve();

    const second = saveAlchemySaveData({ ...defaultSaveData, discoveredCardIds: ["second"] });
    const third = saveAlchemySaveData({ ...defaultSaveData, discoveredCardIds: ["third"] });

    releaseFirstWrite?.();
    await Promise.all([first, second, third]);

    expect(maxInFlightWrites).toBe(1);
    expect(writePayloads).toHaveLength(2);
    expect(JSON.parse(writePayloads[0]).discoveredCardIds).toEqual(["first"]);
    expect(JSON.parse(writePayloads[1]).discoveredCardIds).toEqual(["third"]);
  });

  it("waits for an in-flight save before clearing desktop persistence", async () => {
    let releaseWrite: (() => void) | undefined;
    const writeGate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    let resolveStarted!: () => void;
    const writeStarted = new Promise<void>((resolve) => {
      resolveStarted = resolve;
    });
    const writeSave = vi.fn().mockImplementation(async () => {
      resolveStarted();
      await writeGate;
      return true;
    });
    const desktop = setupMockWindowDesktop({ saveCandidates: [], steamName: null });
    desktop.writeSave = writeSave;
    const clearSave = desktop.clearSave;

    const pendingSave = saveAlchemySaveData({ ...defaultSaveData, discoveredCardIds: ["stale"] });
    await writeStarted;
    expect(writeSave).toHaveBeenCalledOnce();

    const pendingClear = clearAlchemySaveData();
    await Promise.resolve();
    expect(clearSave).not.toHaveBeenCalled();

    releaseWrite?.();
    await pendingSave;
    await pendingClear;

    expect(clearSave).toHaveBeenCalledOnce();
  });

  it("keeps writes disabled after a wipe-for-reload clear so terminal flush cannot restore the save", async () => {
    const futurePayload = JSON.stringify({
      ...currentSchemaCampaignSave(),
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1,
    });
    mockStorage[SAVE_KEY] = futurePayload;

    const loaded = await loadAlchemySaveState();
    expect(loaded.status.kind).toBe("unsupported-newer-schema");

    await expect(clearAlchemySaveData("wipeForReload")).resolves.toBe(true);
    expect(mockStorage[SAVE_KEY]).toBeUndefined();

    await expect(
      saveAlchemySaveDataForExit({ ...defaultSaveData, discoveredCardIds: ["should-not-write"] }),
    ).resolves.toBe("skipped");
    expect(mockStorage[SAVE_KEY]).toBeUndefined();
  });

  it("clears local saves even when Steam Cloud delete fails", async () => {
    // Save Protected escape hatch (App wipe-for-reload) explicitly requests a
    // forced local wipe; plain default clears stay fail-closed (next test).
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const futurePayload = JSON.stringify({
      ...currentSchemaCampaignSave(),
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1,
    });

    const desktop = setupMockWindowDesktop({ saveCandidates: [futurePayload], steamName: "PlayerOne" });
    desktop.steamCloudDelete.mockResolvedValue(false);

    const loaded = await bootstrapAlchemySaveState();
    expect(loaded.status.kind).toBe("unsupported-newer-schema");

    await expect(clearAlchemySaveData("wipeForReload")).resolves.toBe(true);
    expect(desktop.clearSave).toHaveBeenCalledOnce();
    expect(desktop.steamCloudDelete).toHaveBeenCalledOnce();
  });

  it("fails closed without clearing local saves when Steam Cloud delete fails during normal play", async () => {
    const playablePayload = JSON.stringify(currentSchemaCampaignSave());

    const desktop = setupMockWindowDesktop({ saveCandidates: [playablePayload], steamName: "PlayerOne" });
    desktop.steamCloudDelete.mockResolvedValue(false);

    const loaded = await bootstrapAlchemySaveState();
    expect(loaded.status.kind).toBe("ok");

    await expect(clearAlchemySaveData()).resolves.toBe(false);
    expect(desktop.clearSave).not.toHaveBeenCalled();
  });

  it("wipes local saves on deliberate reset even when Steam Cloud delete fails", async () => {
    const playablePayload = JSON.stringify(currentSchemaCampaignSave());

    const desktop = setupMockWindowDesktop({ saveCandidates: [playablePayload], steamName: "PlayerOne" });
    desktop.steamCloudDelete.mockResolvedValue(false);

    const loaded = await bootstrapAlchemySaveState();
    expect(loaded.status.kind).toBe("ok");

    await expect(clearAlchemySaveData("localWipe")).resolves.toBe(true);
    expect(desktop.clearSave).toHaveBeenCalledOnce();
  });
});
