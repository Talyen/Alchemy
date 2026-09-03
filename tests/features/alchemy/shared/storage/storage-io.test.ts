import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { SaveData } from "@/features/alchemy/shared/storage/types";
import { defaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { currentSchemaCampaignSave } from "../../../../fixtures/legacy-saves";
import { SAVE_KEY } from "@/lib/game-constants";
import { CURRENT_CONTENT_VERSION, CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import {
  clearAlchemySaveData,
  loadAlchemySaveState,
  saveAlchemySaveData,
  saveAlchemySaveDataForExit,
  configureSaveBackend,
} from "@/features/alchemy/shared/storage/io";
import { bootstrapAlchemySaveState } from "@/features/alchemy/shared/storage/bootstrap-save-state";
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

function setupDesktopSaveCandidates(candidates: string[]) {
  const desktop = setupMockWindowDesktop({ saveCandidates: candidates, steamName: null });
  return { writeSave: desktop.writeSave };
}

const futureSaveCases = [
  {
    label: "newer schema",
    payload: {
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1,
      lastSavedAt: 2000,
      discoveredCardIds: ["future-card"],
    },
    expectedStatus: {
      kind: "unsupported-newer-schema" as const,
      detectedSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1,
    },
  },
  {
    label: "newer content",
    payload: {
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      contentVersion: CURRENT_CONTENT_VERSION + 1,
      lastSavedAt: 2000,
      discoveredCardIds: ["future-card"],
    },
    expectedStatus: {
      kind: "unsupported-newer-content" as const,
      detectedContentVersion: CURRENT_CONTENT_VERSION + 1,
    },
  },
];

describe("storage io", () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    setupMockWindowBrowser(mockLocalStorage);
  });

  afterEach(() => {
    teardownMockWindow();
  });

  it("loadAlchemySaveState returns defaults when localStorage empty", async () => {
    const data = (await loadAlchemySaveState()).data;
    expect(data.selectedAspectRatio).toBe("auto");
    expect(data.activeRun).toBeNull();
  });

  it("warns when a card effect is corrupt but the rest of the save loads", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const campaign = currentSchemaCampaignSave();
    const activeRun = campaign.activeRun as { runDeck: Array<Record<string, unknown>> } | null;
    if (!activeRun) throw new Error("campaign fixture is missing activeRun");
    mockStorage[SAVE_KEY] = JSON.stringify({
      ...campaign,
      activeRun: {
        ...activeRun,
        runDeck: [
          {
            ...activeRun.runDeck[0],
            effects: [{ kind: "not-a-real-effect" }],
          },
        ],
      },
    });
    const loaded = await loadAlchemySaveState();
    expect(loaded.status.kind).toBe("ok");
    expect(loaded.status.kind === "ok" ? loaded.status.warnings : undefined).toEqual(
      expect.arrayContaining([expect.stringMatching(/Field "effects\[0\]" was corrupt/)]),
    );
    expect(loaded.data.activeRun?.runDeck[0]?.id).toBe("slash");
    expect(loaded.data.activeRun?.runDeck[0]?.effects.length).toBeGreaterThan(0);
  });

  it("loadAlchemySaveState returns defaults on corrupt JSON", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockStorage[SAVE_KEY] = "not-json";
    const data = (await loadAlchemySaveState()).data;
    expect(data.selectedAspectRatio).toBe("auto");
    expect((await loadAlchemySaveState()).status.kind).toBe("corrupt");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Save candidate JSON parse failed"),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it("returns corrupt for a non-object JSON root", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockStorage[SAVE_KEY] = "null";
    const loaded = await loadAlchemySaveState();

    expect(loaded.data).toEqual(defaultSaveData);
    expect(loaded.status.kind).toBe("corrupt");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Save candidate root was not an object"),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it("loadAlchemySaveState loads valid save data", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    mockStorage[SAVE_KEY] = JSON.stringify({ musicVolume: 50, sfxVolume: 50 });
    const data = (await loadAlchemySaveState()).data;
    expect(data.musicVolume).toBe(50);
  });

  it("loadAlchemySaveState loads campaign fixture from localStorage", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    mockStorage[SAVE_KEY] = JSON.stringify(currentSchemaCampaignSave());
    const loaded = await loadAlchemySaveState();

    expect(loaded.status.kind).toBe("ok");
    expect(loaded.data.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(loaded.data.selectedAspectRatio).toBe("auto");
    expect(loaded.data.discoveredCardIds).toEqual(["slash", "block", "bash"]);
    expect(loaded.data.activeRun).toMatchObject({
      characterId: "knight",
      runPlayerHealth: 18,
      contentSystemType: "campaign",
    });
    expect(loaded.data.activeRun).not.toHaveProperty("runGold");
    expect(loaded.data.gold).toBe(42);
    expect(loaded.data.materialInventory).toEqual({ wood: 4, iron: 2, herbs: 0, food: 0, gems: 0 });

    await saveAlchemySaveData(loaded.data);
    const reloaded = JSON.parse(mockStorage[SAVE_KEY]);
    expect(reloaded.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(reloaded.discoveredCardIds).toEqual(["slash", "block", "bash"]);
    expect(reloaded.activeRun).not.toHaveProperty("runGold");
    expect(reloaded.gold).toBe(42);
  });

  it("does not report warnings for harmless save defaults", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    mockStorage[SAVE_KEY] = JSON.stringify({ musicVolume: 50 });
    const loaded = await loadAlchemySaveState();

    expect(loaded.status.kind).toBe("ok");
    expect(loaded.status.kind === "ok" ? loaded.status.warnings : []).toBeUndefined();
  });

  it("reports warnings when an active run cannot be restored and allows writes", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mockStorage[SAVE_KEY] = JSON.stringify({
      activeRun: {
        characterId: "bard",
        runDeck: [],
        runGold: 0,
        runPlayerHealth: 30,
        runMaxHealth: 30,
        roomsEncountered: 1,
        currentAct: 1,
        destinationIndexInAct: 0,
        completedDestinations: [],
        runBoons: [],
        selectedDifficulty: null,
        contentSystemType: "campaign",
        labyrinthMap: null,
      },
    });
    const loaded = await loadAlchemySaveState();

    expect(loaded.status.kind).toBe("ok");
    expect(loaded.status.kind === "ok" ? loaded.status.warnings : []).toContain("active run could not be restored");

    await saveAlchemySaveData({ ...defaultSaveData, discoveredCardIds: ["slash"] });
    expect(JSON.parse(mockStorage[SAVE_KEY]).discoveredCardIds).toEqual(["slash"]);
    expect(JSON.parse(mockStorage[SAVE_KEY]).activeRun).toBeNull();
  });

  it("saveAlchemySaveData writes to localStorage", async () => {
    const data: SaveData = { ...defaultSaveData, selectedAspectRatio: "16:9" };
    await saveAlchemySaveData(data);
    const written = JSON.parse(mockStorage[SAVE_KEY]) as SaveData;
    expect(written.selectedAspectRatio).toBe("16:9");
    expect(written.lastSavedAt).toBeGreaterThan(0);
  });

  it("terminal browser flush supersedes a queued stale snapshot", async () => {
    const pending = saveAlchemySaveData({ ...defaultSaveData, discoveredCardIds: ["stale"] });

    saveAlchemySaveDataForExit({ ...defaultSaveData, discoveredCardIds: ["latest"] });
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

    saveAlchemySaveDataForExit({ ...defaultSaveData, discoveredCardIds: ["latest"] });
    releaseWrite?.();
    await pending;

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
    saveAlchemySaveDataForExit({ ...defaultSaveData, discoveredCardIds: ["resurrect"] });
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
    await expect(saveAlchemySaveData(defaultSaveData)).resolves.not.toThrow();
    await expect(clearAlchemySaveData()).resolves.not.toThrow();
  });

  it.each(futureSaveCases)("does not overwrite a browser save with $label", async ({ payload, expectedStatus }) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockStorage[SAVE_KEY] = JSON.stringify(payload);

    const loaded = await loadAlchemySaveState();

    expect(loaded.data).toEqual(defaultSaveData);
    expect(loaded.status).toEqual(expectedStatus);
    await saveAlchemySaveData({ ...defaultSaveData, discoveredCardIds: ["slash"] });
    expect(JSON.parse(mockStorage[SAVE_KEY])).toEqual(payload);
  });

  it.each(futureSaveCases)(
    "protects a desktop $label authoritative save instead of loading an older backup",
    async ({ payload, expectedStatus }) => {
      const compatibleBackup = JSON.stringify({
        saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
        contentVersion: CURRENT_CONTENT_VERSION,
        lastSavedAt: 1000,
        discoveredCardIds: ["slash"],
      });
      const { writeSave } = setupDesktopSaveCandidates([JSON.stringify(payload), compatibleBackup]);

      const loaded = await loadAlchemySaveState();

      expect(loaded.status).toEqual(expectedStatus);
      await saveAlchemySaveData(loaded.data);
      expect(writeSave).not.toHaveBeenCalled();
    },
  );

  it("protects a future backup after a corrupt local candidate", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const futureBackup = JSON.stringify({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1,
      lastSavedAt: 2000,
    });
    const compatibleOlderBackup = JSON.stringify({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      contentVersion: CURRENT_CONTENT_VERSION,
      lastSavedAt: 1000,
      discoveredCardIds: ["slash"],
    });
    const { writeSave } = setupDesktopSaveCandidates(["not-valid-json", futureBackup, compatibleOlderBackup]);

    const loaded = await loadAlchemySaveState();

    expect(loaded.status).toEqual({
      kind: "unsupported-newer-schema",
      detectedSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1,
    });
    await saveAlchemySaveData(loaded.data);
    expect(writeSave).not.toHaveBeenCalled();
  });

  it("uses a compatible authoritative save without inspecting a future fallback", async () => {
    const compatibleSave = JSON.stringify({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      contentVersion: CURRENT_CONTENT_VERSION,
      discoveredCardIds: ["slash"],
    });
    const futureBackup = JSON.stringify({ saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1 });
    const { writeSave } = setupDesktopSaveCandidates([compatibleSave, futureBackup]);

    const loaded = await loadAlchemySaveState();

    expect(loaded.status.kind).toBe("ok");
    expect(loaded.data.discoveredCardIds).toEqual(["slash"]);
    await saveAlchemySaveData(loaded.data);
    expect(writeSave).toHaveBeenCalledOnce();
  });

  it("walks backup.1 when local is corrupt on desktop", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const validFromBackup = JSON.stringify({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      contentVersion: CURRENT_CONTENT_VERSION,
      discoveredCardIds: ["slash", "block"],
    });
    const corruptLocal = "not-valid-json";

    setupMockWindowDesktop({ saveCandidates: [corruptLocal, validFromBackup], steamName: null });

    const loaded = await loadAlchemySaveState();

    expect(loaded.status.kind).toBe("ok");
    expect(loaded.data.discoveredCardIds).toEqual(["slash", "block"]);
  });

  it("returns corrupt when every candidate fails JSON parsing on desktop", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    setupMockWindowDesktop({ saveCandidates: ["garbage", "also-garbage"], steamName: null });

    const loaded = await loadAlchemySaveState();

    expect(loaded.status.kind).toBe("corrupt");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Save candidate JSON parse failed"),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
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
    const writeSave = vi.fn().mockImplementation(async () => {
      await writeGate;
      return true;
    });
    const desktop = setupMockWindowDesktop({ saveCandidates: [], steamName: null });
    desktop.writeSave = writeSave;
    const clearSave = desktop.clearSave;

    const pendingSave = saveAlchemySaveData({ ...defaultSaveData, discoveredCardIds: ["stale"] });
    await vi.waitFor(() => expect(writeSave).toHaveBeenCalledOnce());

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

    await expect(clearAlchemySaveData({ keepWritesDisabled: true })).resolves.toBe(true);
    expect(mockStorage[SAVE_KEY]).toBeUndefined();

    saveAlchemySaveDataForExit({ ...defaultSaveData, discoveredCardIds: ["should-not-write"] });
    expect(mockStorage[SAVE_KEY]).toBeUndefined();
  });

  it("clears local saves even when Steam Cloud delete fails", async () => {
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

    await expect(clearAlchemySaveData()).resolves.toBe(true);
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
});
