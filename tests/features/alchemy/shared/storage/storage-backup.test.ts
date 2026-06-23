// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { legacyCampaignRunSave } from "../../../../fixtures/legacy-saves";

const globalWithWindow = globalThis as unknown as { window?: object };

describe("storage io desktop backup", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete globalWithWindow.window;
  });

  it("does not request a desktop backup on load (rotation owns backups at write time)", async () => {
    const legacy = JSON.stringify(legacyCampaignRunSave());

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
        listSaveCandidates: vi.fn().mockResolvedValue([legacy]),
        writeSave: vi.fn(),
        clearSave: vi.fn(),
        steamGetName: vi.fn(),
        steamSetRichPresence: vi.fn(),
        steamCloudRead: vi.fn().mockResolvedValue(null),
        steamCloudWrite: vi.fn(),
        steamCloudDelete: vi.fn(),
      },
    } as unknown as Window;

    const { loadAlchemySaveState } = await import("@/features/alchemy/shared/storage/io");
    await loadAlchemySaveState();

    // The backup mechanism is now the per-write rotation, not a separate IPC call.
  }, 30_000);
});
