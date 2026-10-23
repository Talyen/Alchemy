import { deferred } from "../../../../helpers/deferred";
import { createSaveBackend } from "../../../../helpers/save-backend";
import { writeStoragePayload, writeStoragePayloadOnExit } from "../../../../helpers/storage-payload-writes";
import {
  bootstrapAlchemySaveState,
  clearAlchemySaveData,
  loadAlchemySaveState,
} from "@/features/alchemy/shared/storage";
import { defaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { configureSaveBackend } from "@/features/alchemy/shared/storage/io";
import type { SaveData } from "@/features/alchemy/shared/storage/types";
import { SAVE_KEY } from "@/lib/game-constants";
import { describe, expect, it, vi } from "vitest";
import { currentSchemaCampaignSave } from "../../../../fixtures/current-saves";
import { setupMockWindowDesktop } from "../../../../helpers/desktop-save-mock-helper";
import { installBrowserStorageIoTestHooks } from "../../../../helpers/storage-io-test-setup";
import { defaultGameSession } from "@/app/application-session";

const globalWithWindow = globalThis as unknown as { window?: object };
const mockStorage = installBrowserStorageIoTestHooks();

describe("storage io", () => {
  it("writeStoragePayload writes to localStorage", async () => {
    const data: SaveData = { ...defaultSaveData, musicVolume: 25 };
    expect(await writeStoragePayload(data, defaultGameSession)).toBe("saved");
    const written = JSON.parse(mockStorage[SAVE_KEY]) as SaveData;
    expect(written.musicVolume).toBe(25);
    expect(written.lastSavedAt).toBeGreaterThan(0);
  });

  it.each(["reported", "thrown"])("returns failed for a %s backend write failure", async (failure) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("disk unavailable");
    configureSaveBackend(
      createSaveBackend({
        write: async () => {
          if (failure === "thrown") throw error;
          return { ok: false, error };
        },
      }),
      defaultGameSession,
    );
    expect(await writeStoragePayload(defaultSaveData, defaultGameSession)).toBe("failed");
    expect(vi.mocked(console.error).mock.calls[0]?.[0]).toContain("Save data could not be written");
  });

  it("reports serialization failure without invoking the backend", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const write = vi.fn();
    configureSaveBackend(createSaveBackend({ write }), defaultGameSession);
    const data = {
      ...defaultSaveData,
      toJSON: () => {
        throw new Error("serialization");
      },
    };
    expect(await writeStoragePayload(data, defaultGameSession)).toBe("failed");
    expect(await writeStoragePayloadOnExit(data, defaultGameSession)).toBe("failed");
    expect(write).not.toHaveBeenCalled();
  });

  it.each([true, false])("desktop exit completion reports local success=%s only after writing", async (ok) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const gate = deferred<{ ok: true } | { ok: false; error: string }>();
    configureSaveBackend(createSaveBackend({ write: () => gate.promise }), defaultGameSession);
    const completion = writeStoragePayloadOnExit(defaultSaveData, defaultGameSession);
    expect(completion).toBeInstanceOf(Promise);
    let completed = false;
    void Promise.resolve(completion).then(() => {
      completed = true;
    });
    await Promise.resolve();
    expect(completed).toBe(false);
    gate.resolve(ok ? { ok: true } : { ok: false, error: "disk" });
    expect(await completion).toBe(ok ? "saved" : "failed");
  });

  it("terminal browser flush supersedes a queued stale snapshot", async () => {
    const pending = writeStoragePayload({ ...defaultSaveData, discoveredCardIds: ["stale"] }, defaultGameSession);

    await writeStoragePayloadOnExit({ ...defaultSaveData, discoveredCardIds: ["latest"] }, defaultGameSession);
    await pending;

    expect(JSON.parse(mockStorage[SAVE_KEY]).discoveredCardIds).toEqual(["latest"]);
  });

  it("desktop exit flush wins over an async write that is already in flight", async () => {
    const storage: Record<string, string> = {};
    const writeGate = deferred<void>();
    configureSaveBackend(
      createSaveBackend({
        write: async (_key, value) => {
          await writeGate.promise;
          storage[SAVE_KEY] = value;
          return { ok: true };
        },
        writeSync: (_key, value) => {
          storage[SAVE_KEY] = value;
          return { ok: true };
        },
      }),
      defaultGameSession,
    );

    const pending = writeStoragePayload({ ...defaultSaveData, discoveredCardIds: ["stale"] }, defaultGameSession);
    await Promise.resolve();
    await Promise.resolve();

    const exit = writeStoragePayloadOnExit({ ...defaultSaveData, discoveredCardIds: ["latest"] }, defaultGameSession);
    writeGate.resolve();
    await Promise.all([pending, exit]);

    expect(JSON.parse(storage[SAVE_KEY]).discoveredCardIds).toEqual(["latest"]);
  });

  it("skips terminal exit save while a clear is in flight", async () => {
    const clearGate = deferred<void>();
    const writeSync = vi.fn().mockReturnValue({ ok: true });
    configureSaveBackend(
      createSaveBackend({
        clear: async () => {
          await clearGate.promise;
          return { ok: true };
        },
        writeSync,
      }),
      defaultGameSession,
    );

    const pendingClear = clearAlchemySaveData(undefined, defaultGameSession);
    await Promise.resolve();
    await expect(
      writeStoragePayloadOnExit({ ...defaultSaveData, discoveredCardIds: ["resurrect"] }, defaultGameSession),
    ).resolves.toBe("skipped");
    expect(writeSync).not.toHaveBeenCalled();
    clearGate.resolve();
    await pendingClear;
  });

  it("clearAlchemySaveData removes key from localStorage", async () => {
    mockStorage[SAVE_KEY] = "some-data";
    await expect(clearAlchemySaveData(undefined, defaultGameSession)).resolves.toBe(true);
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

    const loaded = await loadAlchemySaveState(defaultGameSession);
    expect(loaded.data).toEqual(defaultSaveData);
    expect(loaded.status.kind).toBe("unavailable");
    await expect(writeStoragePayload(defaultSaveData, defaultGameSession)).resolves.toBe("failed");
    await expect(clearAlchemySaveData(undefined, defaultGameSession)).resolves.not.toThrow();
  });

  it("fails closed without clearing local saves when Steam Cloud delete fails during normal play", async () => {
    const playablePayload = JSON.stringify(currentSchemaCampaignSave());

    const desktop = setupMockWindowDesktop({
      saveCandidates: [playablePayload],
      steamName: "PlayerOne",
      cloudSyncEnabled: true,
    });
    desktop.steamCloudDelete.mockResolvedValue(false);

    const loaded = await bootstrapAlchemySaveState(defaultGameSession);
    expect(loaded.status.kind).toBe("ok");

    await expect(clearAlchemySaveData(undefined, defaultGameSession)).resolves.toBe(false);
    expect(desktop.clearSave).not.toHaveBeenCalled();
  });

  it("wipes local saves on deliberate reset even when Steam Cloud delete fails", async () => {
    const playablePayload = JSON.stringify(currentSchemaCampaignSave());

    const desktop = setupMockWindowDesktop({
      saveCandidates: [playablePayload],
      steamName: "PlayerOne",
      cloudSyncEnabled: true,
    });
    desktop.steamCloudDelete.mockResolvedValue(false);

    const loaded = await bootstrapAlchemySaveState(defaultGameSession);
    expect(loaded.status.kind).toBe("ok");

    await expect(clearAlchemySaveData("localWipe", defaultGameSession)).resolves.toBe(true);
    expect(desktop.clearSave).toHaveBeenCalledOnce();
  });
});
