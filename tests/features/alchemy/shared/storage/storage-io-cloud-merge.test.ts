// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { SAVE_KEY } from "@/lib/game-constants";
import { CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";

const mockStorage: Record<string, string> = {};
const globalWithWindow = globalThis as unknown as { window?: any };

function setupWebWindow() {
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
  } as Window;
}

describe("storage io cloud merge", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    setupWebWindow();
  });

  afterEach(() => {
    delete globalWithWindow.window;
  });

  it("prefers local save over cloud on desktop cold boot", async () => {
    const localSave = {
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      lastSavedAt: 0,
      discoveredCardIds: ["slash"],
      activeRun: null,
    };
    const cloudSave = {
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      lastSavedAt: 0,
      discoveredCardIds: ["slash", "block"],
      activeRun: null,
    };

    globalWithWindow.window!.alchemyDesktop = {
      isDesktop: true,
      setDisplayMode: vi.fn(),
      quit: vi.fn(),
      listSaveCandidates: vi.fn().mockResolvedValue([JSON.stringify(localSave)]),
      writeSave: vi.fn().mockResolvedValue(true),
      clearSave: vi.fn(),
      steamGetName: vi.fn().mockResolvedValue(null),
      steamSetRichPresence: vi.fn(),
      steamCloudRead: vi.fn().mockResolvedValue(JSON.stringify(cloudSave)),
      steamCloudWrite: vi.fn(),
      steamCloudDelete: vi.fn(),
    };

    const { loadAlchemySaveState } = await import("@/features/alchemy/shared/storage/io");
    const loaded = await loadAlchemySaveState();

    expect(loaded.data.discoveredCardIds).toEqual(["slash"]);
    expect(mockStorage[SAVE_KEY]).toBeUndefined();
  });

  it("falls back to cloud when local save is missing", async () => {
    const cloudSave = {
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      lastSavedAt: 0,
      discoveredCardIds: ["slash", "block"],
      activeRun: null,
    };

    globalWithWindow.window!.alchemyDesktop = {
      isDesktop: true,
      setDisplayMode: vi.fn(),
      quit: vi.fn(),
      listSaveCandidates: vi.fn().mockResolvedValue([]),
      writeSave: vi.fn().mockResolvedValue(true),
      clearSave: vi.fn(),
      steamGetName: vi.fn().mockResolvedValue(null),
      steamSetRichPresence: vi.fn(),
      steamCloudRead: vi.fn().mockResolvedValue(JSON.stringify(cloudSave)),
      steamCloudWrite: vi.fn(),
      steamCloudDelete: vi.fn(),
    };

    const { loadAlchemySaveState } = await import("@/features/alchemy/shared/storage/io");
    const loaded = await loadAlchemySaveState();

    expect(loaded.data.discoveredCardIds).toEqual(["slash", "block"]);
    expect(loaded.status.kind).toBe("ok");
  });
});
