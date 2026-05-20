import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { SaveData } from "@/features/alchemy/storage/types";
import { defaultSaveData } from "@/features/alchemy/storage/defaults";

const { SAVE_KEY } = await import("@/lib/game-constants");
const { CURRENT_SAVE_SCHEMA_VERSION } = await import("@/features/alchemy/storage/metadata");

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
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    setupWindow();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    teardownWindow();
  });

  it("loadAlchemySaveData returns defaults when localStorage empty", async () => {
    const { loadAlchemySaveData } = await import("@/features/alchemy/storage/io");
    const data = loadAlchemySaveData();
    expect(data.selectedAspectRatio).toBe("auto");
    expect(data.activeRun).toBeNull();
  });

  it("loadAlchemySaveData returns defaults on corrupt JSON", async () => {
    mockStorage[SAVE_KEY] = "not-json";
    const { loadAlchemySaveData, loadAlchemySaveState } = await import("@/features/alchemy/storage/io");
    const data = loadAlchemySaveData();
    expect(data.selectedAspectRatio).toBe("auto");
    expect(loadAlchemySaveState().status.kind).toBe("corrupt");
  });

  it("loadAlchemySaveData loads valid save data", async () => {
    mockStorage[SAVE_KEY] = JSON.stringify({ musicVolume: 50, sfxVolume: 50 });
    const { loadAlchemySaveData } = await import("@/features/alchemy/storage/io");
    const data = loadAlchemySaveData();
    expect(data.musicVolume).toBe(50);
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

    const { loadAlchemySaveData, saveAlchemySaveData, clearAlchemySaveData } = await import(
      "@/features/alchemy/storage/io"
    );

    expect(loadAlchemySaveData()).toEqual(defaultSaveData);
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
});
