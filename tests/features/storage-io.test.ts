import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { defaultSaveData, type SaveData } from "@/features/alchemy/storage/types";

const { SAVE_KEY } = await import("@/lib/game-constants");

const mockStorage: Record<string, string> = {};
const globalWithWindow = globalThis as typeof globalThis & { window?: Pick<Window, "localStorage"> };

function setupWindow() {
  globalWithWindow.window = {
    localStorage: {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => { mockStorage[key] = value; },
      removeItem: (key: string) => { delete mockStorage[key]; },
    } as Storage,
  };
}

function teardownWindow() {
  delete globalWithWindow.window;
}

describe("storage io", () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    setupWindow();
  });

  afterEach(() => {
    teardownWindow();
  });

  it("loadAlchemySaveData returns defaults when localStorage empty", async () => {
    const { loadAlchemySaveData } = await import("@/features/alchemy/storage/io");
    const data = loadAlchemySaveData();
    expect(data.selectedResolution).toBe("1920x1080");
    expect(data.activeRun).toBeNull();
  });

  it("loadAlchemySaveData returns defaults on corrupt JSON", async () => {
    mockStorage[SAVE_KEY] = "not-json";
    const { loadAlchemySaveData } = await import("@/features/alchemy/storage/io");
    const data = loadAlchemySaveData();
    expect(data.selectedResolution).toBe("1920x1080");
  });

  it("loadAlchemySaveData loads valid save data", async () => {
    mockStorage[SAVE_KEY] = JSON.stringify({ musicVolume: 35, sfxVolume: 70 });
    const { loadAlchemySaveData } = await import("@/features/alchemy/storage/io");
    const data = loadAlchemySaveData();
    expect(data.musicVolume).toBe(35);
  });

  it("saveAlchemySaveData writes to localStorage", async () => {
    const { saveAlchemySaveData } = await import("@/features/alchemy/storage/io");
    const data: SaveData = { ...defaultSaveData, selectedResolution: "1920x1080" };
    saveAlchemySaveData(data);
    expect(mockStorage[SAVE_KEY]).toBe(JSON.stringify(data));
  });

  it("clearAlchemySaveData removes key from localStorage", async () => {
    mockStorage[SAVE_KEY] = "some-data";
    const { clearAlchemySaveData } = await import("@/features/alchemy/storage/io");
    clearAlchemySaveData();
    expect(mockStorage[SAVE_KEY]).toBeUndefined();
  });
});
