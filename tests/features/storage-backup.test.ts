// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { legacyCampaignRunSave } from "../fixtures/legacy-saves";

const globalWithWindow = globalThis as typeof globalThis & { window?: Window & { alchemyDesktop?: Window["alchemyDesktop"] } };

describe("storage io desktop backup", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete globalWithWindow.window;
  });

  it("requests a desktop backup once when loading a save that requires migration", async () => {
    const backupSave = vi.fn().mockResolvedValue(true);
    const legacy = JSON.stringify(legacyCampaignRunSave());

    globalWithWindow.window = {
      localStorage: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      } as Storage,
      alchemyDesktop: {
        isDesktop: true,
        setDisplayMode: vi.fn(),
        quit: vi.fn(),
        loadSave: vi.fn().mockResolvedValue(legacy),
        writeSave: vi.fn(),
        backupSave,
        clearSave: vi.fn(),
        steamGetName: vi.fn(),
        steamSetRichPresence: vi.fn(),
        steamCloudRead: vi.fn().mockResolvedValue(null),
        steamCloudWrite: vi.fn(),
        steamCloudDelete: vi.fn(),
      },
    } as Window;

    const { loadAlchemySaveState } = await import("@/features/alchemy/shared/storage/io");
    await loadAlchemySaveState();

    expect(backupSave).toHaveBeenCalledTimes(1);
  }, 10_000);
});
