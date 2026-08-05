import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { SaveData } from "@/features/alchemy/shared/storage/types";
import { defaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { legacyCampaignRunSave } from "../../../../fixtures/legacy-saves";

const { SAVE_KEY } = await import("@/lib/game-constants");
const { CURRENT_CONTENT_VERSION, CURRENT_SAVE_SCHEMA_VERSION } = await import("@/lib/validation");

const mockStorage: Record<string, string> = {};
const globalWithWindow = globalThis as unknown as { window?: object };

function setupWindow() {
  globalWithWindow.window = {
    localStorage: {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
    } as Storage,
  };
}

function teardownWindow() {
  delete globalWithWindow.window;
}

describe("storage io", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    setupWindow();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    teardownWindow();
  });

  it("loadAlchemySaveState returns defaults when localStorage empty", async () => {
    const { loadAlchemySaveState } = await import("@/features/alchemy/shared/storage/io");
    const data = (await loadAlchemySaveState()).data;
    expect(data.selectedAspectRatio).toBe("auto");
    expect(data.activeRun).toBeNull();
  });

  it("loadAlchemySaveState returns defaults on corrupt JSON", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockStorage[SAVE_KEY] = "not-json";
    const { loadAlchemySaveState } = await import("@/features/alchemy/shared/storage/io");
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

  it("loadAlchemySaveState loads valid save data", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    mockStorage[SAVE_KEY] = JSON.stringify({ musicVolume: 50, sfxVolume: 50 });
    const { loadAlchemySaveState } = await import("@/features/alchemy/shared/storage/io");
    const data = (await loadAlchemySaveState()).data;
    expect(data.musicVolume).toBe(50);
  });

  it("loadAlchemySaveState migrates legacy campaign fixture from localStorage", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    mockStorage[SAVE_KEY] = JSON.stringify(legacyCampaignRunSave());
    const { loadAlchemySaveState, saveAlchemySaveData } = await import("@/features/alchemy/shared/storage/io");

    const loaded = await loadAlchemySaveState();

    expect(loaded.status.kind).toBe("ok");
    expect(loaded.data.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(loaded.data.selectedAspectRatio).toBe("auto");
    expect(loaded.data.discoveredCardIds).toEqual(["slash", "block", "future-card"]);
    expect(loaded.data.activeRun).toMatchObject({
      characterId: "knight",
      runGold: 42,
      runPlayerHealth: 18,
      contentSystemType: "campaign",
    });
    expect(loaded.data.materialInventory).toEqual({ wood: 4, iron: 2, herbs: 0, food: 0, crystal: 0 });

    await saveAlchemySaveData(loaded.data);
    const reloaded = JSON.parse(mockStorage[SAVE_KEY]);
    expect(reloaded.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(reloaded.discoveredCardIds).toEqual(["slash", "block", "future-card"]);
    expect(reloaded.activeRun.runGold).toBe(42);
  });

  it("does not report warnings for harmless save defaults", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    mockStorage[SAVE_KEY] = JSON.stringify({ musicVolume: 50 });
    const { loadAlchemySaveState } = await import("@/features/alchemy/shared/storage/io");

    const loaded = await loadAlchemySaveState();

    expect(loaded.status.kind).toBe("ok");
    expect(loaded.status.kind === "ok" ? loaded.status.warnings : []).toBeUndefined();
  });

  it("reports warnings when an active run cannot be restored and allows writes", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
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
        runTrinkets: [],
        selectedDifficulty: null,
        contentSystemType: "campaign",
        labyrinthMap: null,
      },
    });
    const { loadAlchemySaveState, saveAlchemySaveData } = await import("@/features/alchemy/shared/storage/io");

    const loaded = await loadAlchemySaveState();

    expect(loaded.status.kind).toBe("ok");
    expect(loaded.status.kind === "ok" ? loaded.status.warnings : []).toContain("active run could not be restored");

    await saveAlchemySaveData({ ...defaultSaveData, discoveredCardIds: ["slash"] });
    expect(JSON.parse(mockStorage[SAVE_KEY]).discoveredCardIds).toEqual(["slash"]);
    expect(JSON.parse(mockStorage[SAVE_KEY]).activeRun).toBeNull();
  });

  it("saveAlchemySaveData writes to localStorage", async () => {
    const { saveAlchemySaveData } = await import("@/features/alchemy/shared/storage/io");
    const data: SaveData = { ...defaultSaveData, selectedAspectRatio: "16:9" };
    await saveAlchemySaveData(data);
    const written = JSON.parse(mockStorage[SAVE_KEY]) as SaveData;
    expect(written.selectedAspectRatio).toBe("16:9");
    expect(written.lastSavedAt).toBeGreaterThan(0);
  });

  it("clearAlchemySaveData removes key from localStorage", async () => {
    mockStorage[SAVE_KEY] = "some-data";
    const { clearAlchemySaveData } = await import("@/features/alchemy/shared/storage/io");
    await clearAlchemySaveData();
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

    const { loadAlchemySaveState, saveAlchemySaveData, clearAlchemySaveData } =
      await import("@/features/alchemy/shared/storage/io");

    expect((await loadAlchemySaveState()).data).toEqual(defaultSaveData);
    await expect(saveAlchemySaveData(defaultSaveData)).resolves.not.toThrow();
    await expect(clearAlchemySaveData()).resolves.not.toThrow();
  });

  it("does not overwrite saves from a newer schema", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockStorage[SAVE_KEY] = JSON.stringify({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1,
      discoveredCardIds: ["future-card"],
    });

    const { loadAlchemySaveState, saveAlchemySaveData } = await import("@/features/alchemy/shared/storage/io");
    const loaded = await loadAlchemySaveState();

    expect(loaded.data).toEqual(defaultSaveData);
    expect(loaded.status).toEqual({
      kind: "unsupported-newer-schema",
      detectedSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1,
    });
    await saveAlchemySaveData({ ...defaultSaveData, discoveredCardIds: ["slash"] });
    expect(JSON.parse(mockStorage[SAVE_KEY])).toEqual({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1,
      discoveredCardIds: ["future-card"],
    });
  });

  it("does not overwrite saves with newer content", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockStorage[SAVE_KEY] = JSON.stringify({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      contentVersion: CURRENT_CONTENT_VERSION + 1,
      discoveredCardIds: ["future-card"],
    });

    const { loadAlchemySaveState, saveAlchemySaveData } = await import("@/features/alchemy/shared/storage/io");
    const loaded = await loadAlchemySaveState();

    expect(loaded.data).toEqual(defaultSaveData);
    expect(loaded.status).toEqual({
      kind: "unsupported-newer-content",
      detectedContentVersion: CURRENT_CONTENT_VERSION + 1,
    });
    await saveAlchemySaveData({ ...defaultSaveData, discoveredCardIds: ["slash"] });
    expect(JSON.parse(mockStorage[SAVE_KEY])).toEqual({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      contentVersion: CURRENT_CONTENT_VERSION + 1,
      discoveredCardIds: ["future-card"],
    });
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

    (globalWithWindow as { window?: object }).window = {
      localStorage: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      } as unknown as Storage,
      alchemyDesktop: {
        isDesktop: true,
        setDisplayMode: vi.fn(),
        quit: vi.fn(),
        listSaveCandidates: vi.fn().mockResolvedValue([corruptLocal, validFromBackup]),
        writeSave: vi.fn().mockResolvedValue(true),
        clearSave: vi.fn(),
        steamGetName: vi.fn().mockResolvedValue(null),
        steamSetRichPresence: vi.fn(),
        steamCloudRead: vi.fn().mockResolvedValue(null),
        steamCloudWrite: vi.fn(),
        steamCloudDelete: vi.fn(),
      },
    } as unknown as Window;

    const { loadAlchemySaveState } = await import("@/features/alchemy/shared/storage/io");
    const loaded = await loadAlchemySaveState();

    expect(loaded.status.kind).toBe("ok");
    expect(loaded.data.discoveredCardIds).toEqual(["slash", "block"]);
  });

  it("returns corrupt when every candidate fails JSON parsing on desktop", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    (globalWithWindow as { window?: object }).window = {
      localStorage: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      } as unknown as Storage,
      alchemyDesktop: {
        isDesktop: true,
        setDisplayMode: vi.fn(),
        quit: vi.fn(),
        listSaveCandidates: vi.fn().mockResolvedValue(["garbage", "also-garbage"]),
        writeSave: vi.fn().mockResolvedValue(true),
        clearSave: vi.fn(),
        steamGetName: vi.fn().mockResolvedValue(null),
        steamSetRichPresence: vi.fn(),
        steamCloudRead: vi.fn().mockResolvedValue(null),
        steamCloudWrite: vi.fn(),
        steamCloudDelete: vi.fn(),
      },
    } as unknown as Window;

    const { loadAlchemySaveState } = await import("@/features/alchemy/shared/storage/io");
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

    (globalWithWindow as { window?: object }).window = {
      localStorage: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      } as unknown as Storage,
      alchemyDesktop: {
        isDesktop: true,
        setDisplayMode: vi.fn(),
        quit: vi.fn(),
        listSaveCandidates: vi.fn().mockResolvedValue([]),
        writeSave: vi.fn().mockImplementation(async (payload: string) => {
          inFlightWrites += 1;
          maxInFlightWrites = Math.max(maxInFlightWrites, inFlightWrites);
          writePayloads.push(payload);
          if (writePayloads.length === 1) await firstWriteGate;
          inFlightWrites -= 1;
          return true;
        }),
        clearSave: vi.fn(),
        steamGetName: vi.fn().mockResolvedValue(null),
        steamSetRichPresence: vi.fn(),
        steamCloudRead: vi.fn().mockResolvedValue(null),
        steamCloudWrite: vi.fn().mockResolvedValue(true),
        steamCloudDelete: vi.fn(),
      },
    } as unknown as Window;

    const { saveAlchemySaveData } = await import("@/features/alchemy/shared/storage/io");
    const first = saveAlchemySaveData({ ...defaultSaveData, discoveredCardIds: ["first"] });
    // Let the first write enter writeSave and block on the gate.
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
    const clearSave = vi.fn().mockResolvedValue(true);

    (globalWithWindow as { window?: object }).window = {
      localStorage: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      } as unknown as Storage,
      alchemyDesktop: {
        isDesktop: true,
        setDisplayMode: vi.fn(),
        quit: vi.fn(),
        listSaveCandidates: vi.fn().mockResolvedValue([]),
        writeSave,
        clearSave,
        steamGetName: vi.fn().mockResolvedValue(null),
        steamSetRichPresence: vi.fn(),
        steamCloudRead: vi.fn().mockResolvedValue(null),
        steamCloudWrite: vi.fn().mockResolvedValue(true),
        steamCloudDelete: vi.fn().mockResolvedValue(true),
      },
    } as unknown as Window;

    const { clearAlchemySaveData, saveAlchemySaveData } = await import("@/features/alchemy/shared/storage/io");
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
});
