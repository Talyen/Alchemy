// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const globalWithWindow = globalThis as typeof globalThis & { window?: Window & { alchemyDesktop?: Window["alchemyDesktop"] } };

describe("bootstrapAlchemySaveState", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete globalWithWindow.window;
  });

  it("initializes Steam before loading on desktop", async () => {
    const steamGetName = vi.fn().mockResolvedValue("Tester");
    const loadSave = vi.fn().mockResolvedValue(null);

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
        loadSave,
        writeSave: vi.fn(),
        backupSave: vi.fn(),
        clearSave: vi.fn(),
        steamGetName,
        steamSetRichPresence: vi.fn(),
        steamCloudRead: vi.fn().mockResolvedValue(null),
        steamCloudWrite: vi.fn(),
        steamCloudDelete: vi.fn(),
      },
    } as Window;

    const { bootstrapAlchemySaveState } = await import("@/features/alchemy/shared/storage/bootstrap-save-state");
    await bootstrapAlchemySaveState();

    expect(steamGetName).toHaveBeenCalled();
    expect(loadSave).toHaveBeenCalled();
  }, 10_000);
});
