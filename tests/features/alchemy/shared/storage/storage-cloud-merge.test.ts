import { loadAlchemySaveState } from "@/features/alchemy/shared/storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  setupMockWindowBrowser,
  setupMockWindowDesktop,
  teardownMockWindow,
} from "../../../../helpers/desktop-save-mock-helper";
import { playableSaveCandidate } from "../../../../helpers/save-candidate-fixtures";
import { installStorageIoTestHooks } from "../../../../helpers/storage-io-test-setup";

const mockStorage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
} as Storage;

installStorageIoTestHooks();

describe("storage io", () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    setupMockWindowBrowser(mockLocalStorage);
  });

  afterEach(() => {
    teardownMockWindow();
  });

  describe("desktop cloud merge", () => {
    it("falls back to cloud when local save is missing", async () => {
      const cloudSave = playableSaveCandidate(0, { discoveredCardIds: ["slash", "block"] });

      const desktop = setupMockWindowDesktop({
        saveCandidates: [],
        steamName: null,
      });
      desktop.steamCloudRead.mockResolvedValue(cloudSave);

      const loaded = await loadAlchemySaveState();

      expect(loaded.data.discoveredCardIds).toEqual(["slash", "block"]);
      expect(loaded.status.kind).toBe("ok");
    });

    it("prefers local save over cloud on desktop cold boot", async () => {
      const localSave = playableSaveCandidate(0);
      const cloudSave = playableSaveCandidate(0, { discoveredCardIds: ["slash", "block"] });

      const desktop = setupMockWindowDesktop({
        saveCandidates: [localSave],
        steamName: null,
      });
      desktop.steamCloudRead.mockResolvedValue(cloudSave);

      const loaded = await loadAlchemySaveState();

      expect(loaded.data.discoveredCardIds).toEqual(["slash"]);
    });

    it("loads the fresher cloud save over a stale local save", async () => {
      const localSave = playableSaveCandidate(1000);
      const cloudSave = playableSaveCandidate(2000, { discoveredCardIds: ["slash", "block"] });

      const desktop = setupMockWindowDesktop({
        saveCandidates: [localSave],
        steamName: null,
      });
      desktop.steamCloudRead.mockResolvedValue(cloudSave);

      const loaded = await loadAlchemySaveState();

      expect(loaded.data.discoveredCardIds).toEqual(["slash", "block"]);
      expect(loaded.data.lastSavedAt).toBe(2000);
    });

    it("ignores a corrupt cloud candidate when the local save is valid", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const desktop = setupMockWindowDesktop({
        saveCandidates: [playableSaveCandidate(1000)],
        steamName: null,
      });
      desktop.steamCloudRead.mockResolvedValue("not-valid-json");

      const loaded = await loadAlchemySaveState();

      expect(loaded.status.kind).toBe("ok");
      expect(loaded.data.discoveredCardIds).toEqual(["slash"]);
    });
  });
});
