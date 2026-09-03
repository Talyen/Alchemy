import { afterEach, describe, expect, it } from "vitest";
import { CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import { setupMockWindowDesktop } from "../../../../helpers/desktop-save-mock-helper";
import { loadAlchemySaveState } from "@/features/alchemy/shared/storage/io";
import { installStorageIoTestHooks } from "../../../../helpers/storage-io-test-setup";

const globalWithWindow = globalThis as unknown as { window?: object };

installStorageIoTestHooks();

describe("storage io cloud merge", () => {
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

    const desktop = setupMockWindowDesktop({
      saveCandidates: [JSON.stringify(localSave)],
      steamName: null,
    });
    desktop.steamCloudRead.mockResolvedValue(JSON.stringify(cloudSave));

    const loaded = await loadAlchemySaveState();

    expect(loaded.data.discoveredCardIds).toEqual(["slash"]);
  });

  it("loads the fresher cloud save over a stale local save", async () => {
    const localSave = {
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      lastSavedAt: 1000,
      discoveredCardIds: ["slash"],
      activeRun: null,
    };
    const cloudSave = {
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      lastSavedAt: 2000,
      discoveredCardIds: ["slash", "block"],
      activeRun: null,
    };

    const desktop = setupMockWindowDesktop({
      saveCandidates: [JSON.stringify(localSave)],
      steamName: null,
    });
    desktop.steamCloudRead.mockResolvedValue(JSON.stringify(cloudSave));

    const loaded = await loadAlchemySaveState();

    expect(loaded.data.discoveredCardIds).toEqual(["slash", "block"]);
    expect(loaded.data.lastSavedAt).toBe(2000);
  });

  it("falls back to cloud when local save is missing", async () => {
    const cloudSave = {
      saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
      lastSavedAt: 0,
      discoveredCardIds: ["slash", "block"],
      activeRun: null,
    };

    const desktop = setupMockWindowDesktop({
      saveCandidates: [],
      steamName: null,
    });
    desktop.steamCloudRead.mockResolvedValue(JSON.stringify(cloudSave));

    const loaded = await loadAlchemySaveState();

    expect(loaded.data.discoveredCardIds).toEqual(["slash", "block"]);
    expect(loaded.status.kind).toBe("ok");
  });
});
