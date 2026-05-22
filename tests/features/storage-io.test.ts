import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { SaveData } from "@/features/alchemy/storage/types";
import { defaultSaveData } from "@/features/alchemy/storage/defaults";

const { SAVE_KEY } = await import("@/lib/game-constants");
const { CURRENT_CONTENT_VERSION, CURRENT_SAVE_SCHEMA_VERSION } = await import("@/features/alchemy/storage/metadata");

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
    const data = loadAlchemySaveState().data;
    expect(data.selectedAspectRatio).toBe("auto");
    expect(data.activeRun).toBeNull();
  });

  it("loadAlchemySaveState returns defaults on corrupt JSON", async () => {
    mockStorage[SAVE_KEY] = "not-json";
    const { loadAlchemySaveState } = await import("@/features/alchemy/storage/io");
    const data = loadAlchemySaveState().data;
    expect(data.selectedAspectRatio).toBe("auto");
    expect(loadAlchemySaveState().status.kind).toBe("corrupt");
  });

  it("loadAlchemySaveState loads valid save data", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    mockStorage[SAVE_KEY] = JSON.stringify({ musicVolume: 50, sfxVolume: 50 });
    const { loadAlchemySaveState } = await import("@/features/alchemy/storage/io");
    const data = loadAlchemySaveState().data;
    expect(data.musicVolume).toBe(50);
  });

  it("does not report warnings for harmless save defaults", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    mockStorage[SAVE_KEY] = JSON.stringify({ musicVolume: 50 });
    const { loadAlchemySaveState } = await import("@/features/alchemy/storage/io");

    const loaded = loadAlchemySaveState();

    expect(loaded.status.kind).toBe("ok");
    expect(loaded.status.kind === "ok" ? loaded.status.warnings : []).toBeUndefined();
  });

  it("reports warnings when an active run cannot be restored", async () => {
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
    const { loadAlchemySaveState } = await import("@/features/alchemy/storage/io");

    const loaded = loadAlchemySaveState();

    expect(loaded.status.kind).toBe("ok");
    expect(loaded.status.kind === "ok" ? loaded.status.warnings : []).toContain("active run could not be restored");

    const { saveAlchemySaveData } = await import("@/features/alchemy/storage/io");
    saveAlchemySaveData({ ...defaultSaveData, discoveredCardIds: ["slash"] });
    expect(JSON.parse(mockStorage[SAVE_KEY]).activeRun).toMatchObject({ characterId: "bard" });
  });

  it("saveAlchemySaveData writes to localStorage", async () => {
    const { saveAlchemySaveData } = await import("@/features/alchemy/storage/io");
    const data: SaveData = { ...defaultSaveData, selectedAspectRatio: "16:9" };
    saveAlchemySaveData(data);
    expect(mockStorage[SAVE_KEY]).toBe(JSON.stringify(data));
  });

  it("clearAlchemySaveData removes key from localStorage", async () => {
    mockStorage[SAVE_KEY] = "some-data";
    const { clearAlchemySaveData } = await import("@/features/alchemy/storage/io");
    clearAlchemySaveData();
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

    expect(loadAlchemySaveState().data).toEqual(defaultSaveData);
    expect(() => saveAlchemySaveData(defaultSaveData)).not.toThrow();
    expect(() => clearAlchemySaveData()).not.toThrow();
  });

  it("does not overwrite saves from a newer schema", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockStorage[SAVE_KEY] = JSON.stringify({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1,
      discoveredCardIds: ["future-card"],
    });

    const { loadAlchemySaveState, saveAlchemySaveData } = await import("@/features/alchemy/storage/io");
    const loaded = loadAlchemySaveState();

    expect(loaded.data).toEqual(defaultSaveData);
    expect(loaded.status).toEqual({
      kind: "unsupported-newer-schema",
      detectedSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION + 1,
    });
    saveAlchemySaveData({ ...defaultSaveData, discoveredCardIds: ["slash"] });
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
    const loaded = loadAlchemySaveState();

    expect(loaded.data).toEqual(defaultSaveData);
    expect(loaded.status).toEqual({
      kind: "unsupported-newer-content",
      detectedContentVersion: CURRENT_CONTENT_VERSION + 1,
    });
    saveAlchemySaveData({ ...defaultSaveData, discoveredCardIds: ["slash"] });
    expect(JSON.parse(mockStorage[SAVE_KEY])).toEqual({
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      contentVersion: CURRENT_CONTENT_VERSION + 1,
      discoveredCardIds: ["future-card"],
    });
  });
});
