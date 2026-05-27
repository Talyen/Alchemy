import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { SaveData } from "@/features/alchemy/storage/types";
import { defaultSaveData } from "@/features/alchemy/storage/defaults";
import { legacyCampaignRunSave } from "../fixtures/legacy-saves";

const { SAVE_KEY } = await import("@/lib/game-constants");
const { CURRENT_CONTENT_VERSION, CURRENT_SAVE_SCHEMA_VERSION } = await import("@/lib/validation");

const mockStorage: Record<string, string> = {};
const globalWithWindow = globalThis as typeof globalThis & { window?: Pick<Window, "localStorage"> };

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
    const { loadAlchemySaveState } = await import("@/features/alchemy/storage/io");
    const data = (await loadAlchemySaveState()).data;
    expect(data.selectedAspectRatio).toBe("auto");
    expect(data.activeRun).toBeNull();
  });

  it("loadAlchemySaveState returns defaults on corrupt JSON", async () => {
    mockStorage[SAVE_KEY] = "not-json";
    const { loadAlchemySaveState } = await import("@/features/alchemy/storage/io");
    const data = (await loadAlchemySaveState()).data;
    expect(data.selectedAspectRatio).toBe("auto");
    expect((await loadAlchemySaveState()).status.kind).toBe("corrupt");
  });

  it("loadAlchemySaveState loads valid save data", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    mockStorage[SAVE_KEY] = JSON.stringify({ musicVolume: 50, sfxVolume: 50 });
    const { loadAlchemySaveState } = await import("@/features/alchemy/storage/io");
    const data = (await loadAlchemySaveState()).data;
    expect(data.musicVolume).toBe(50);
  });

  it("loadAlchemySaveState migrates legacy campaign fixture from localStorage", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    mockStorage[SAVE_KEY] = JSON.stringify(legacyCampaignRunSave());
    const { loadAlchemySaveState, saveAlchemySaveData } = await import("@/features/alchemy/storage/io");

    const loaded = await loadAlchemySaveState();

    expect(loaded.status.kind).toBe("ok");
    expect(loaded.data.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(loaded.data.selectedAspectRatio).toBe("16:9");
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
    const { loadAlchemySaveState } = await import("@/features/alchemy/storage/io");

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
    const { loadAlchemySaveState, saveAlchemySaveData } = await import("@/features/alchemy/storage/io");

    const loaded = await loadAlchemySaveState();

    expect(loaded.status.kind).toBe("ok");
    expect(loaded.status.kind === "ok" ? loaded.status.warnings : []).toContain("active run could not be restored");

    await saveAlchemySaveData({ ...defaultSaveData, discoveredCardIds: ["slash"] });
    expect(JSON.parse(mockStorage[SAVE_KEY]).discoveredCardIds).toEqual(["slash"]);
    expect(JSON.parse(mockStorage[SAVE_KEY]).activeRun).toBeNull();
  });

  it("saveAlchemySaveData writes to localStorage", async () => {
    const { saveAlchemySaveData } = await import("@/features/alchemy/storage/io");
    const data: SaveData = { ...defaultSaveData, selectedAspectRatio: "16:9" };
    await saveAlchemySaveData(data);
    expect(mockStorage[SAVE_KEY]).toBe(JSON.stringify(data));
  });

  it("clearAlchemySaveData removes key from localStorage", async () => {
    mockStorage[SAVE_KEY] = "some-data";
    const { clearAlchemySaveData } = await import("@/features/alchemy/storage/io");
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

    const { loadAlchemySaveState, saveAlchemySaveData, clearAlchemySaveData } = await import(
      "@/features/alchemy/storage/io"
    );

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

    const { loadAlchemySaveState, saveAlchemySaveData } = await import("@/features/alchemy/storage/io");
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

    const { loadAlchemySaveState, saveAlchemySaveData } = await import("@/features/alchemy/storage/io");
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
});
