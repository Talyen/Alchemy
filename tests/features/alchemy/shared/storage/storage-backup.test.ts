import { afterEach, describe, expect, it } from "vitest";
import { currentSchemaCampaignSave } from "../../../../fixtures/legacy-saves";
import { setupMockWindowDesktop } from "../../../../helpers/desktop-save-mock-helper";
import { loadAlchemySaveState } from "@/features/alchemy/shared/storage/io";
import { installStorageIoTestHooks } from "../../../../helpers/storage-io-test-setup";

const globalWithWindow = globalThis as unknown as { window?: object };

installStorageIoTestHooks();

describe("storage io desktop backup", () => {
  afterEach(() => {
    delete globalWithWindow.window;
  });

  it("does not request a desktop backup on load (rotation owns backups at write time)", async () => {
    const legacy = JSON.stringify(currentSchemaCampaignSave());
    const desktop = setupMockWindowDesktop({ saveCandidates: [legacy] });

    await loadAlchemySaveState();

    expect(desktop.writeSave).not.toHaveBeenCalled();
  });
});
