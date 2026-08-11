// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const globalWithWindow = globalThis as unknown as { window?: object };

describe("bootstrapAlchemySaveState", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete globalWithWindow.window;
  });

  it("initializes Steam before loading on desktop", async () => {
    const steamGetName = vi.fn().mockResolvedValue("Tester");
    const listSaveCandidates = vi.fn().mockResolvedValue([]);

    globalWithWindow.window = {
      localStorage: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      } as unknown as Storage,
      alchemyDesktop: {
        isDesktop: true,
        setDisplayMode: vi.fn(),
        quit: vi.fn(),
        listSaveCandidates,
        writeSave: vi.fn(),
        clearSave: vi.fn(),
        steamGetName,
        steamSetRichPresence: vi.fn(),
        steamCloudRead: vi.fn().mockResolvedValue(null),
        steamCloudWrite: vi.fn(),
        steamCloudDelete: vi.fn(),
      },
    } as unknown as Window;

    const { bootstrapAlchemySaveState } = await import("@/features/alchemy/shared/storage/bootstrap-save-state");
    await bootstrapAlchemySaveState();

    expect(steamGetName).toHaveBeenCalled();
    expect(listSaveCandidates).toHaveBeenCalled();
  }, 30_000);

  it("enables cloud mirroring only from successful Steam initialization", async () => {
    const order: string[] = [];
    globalWithWindow.window = {
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
        writeSave: vi.fn().mockImplementation(async () => {
          order.push("local");
          return true;
        }),
        clearSave: vi.fn(),
        steamGetName: vi.fn().mockResolvedValue("Tester"),
        steamSetRichPresence: vi.fn(),
        steamCloudRead: vi.fn().mockResolvedValue(null),
        steamCloudWrite: vi.fn().mockImplementation(async () => {
          order.push("cloud");
          return true;
        }),
        steamCloudDelete: vi.fn(),
      },
    } as unknown as Window;

    const { bootstrapAlchemySaveState } = await import("@/features/alchemy/shared/storage/bootstrap-save-state");
    const { defaultSaveData } = await import("@/features/alchemy/shared/storage/defaults");
    const { saveAlchemySaveData } = await import("@/features/alchemy/shared/storage/io");

    await bootstrapAlchemySaveState();
    await saveAlchemySaveData(defaultSaveData);

    expect(order).toEqual(["local", "cloud"]);
  }, 30_000);
});
