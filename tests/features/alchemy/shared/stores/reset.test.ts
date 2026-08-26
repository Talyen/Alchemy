import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/features/alchemy/shared/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/shared/storage")>();
  return {
    ...actual,
    clearAlchemySaveData: vi.fn(),
  };
});

import { clearAlchemySaveData } from "@/features/alchemy/shared/storage";
import { clearAllPersistentGameData } from "@/features/alchemy/shared/stores/reset";
import { useProfileStore } from "../../../../helpers/gameplay-store-test";
import { useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { defaultSaveData } from "@/features/alchemy/shared/storage";
import { useRunProfileStore } from "../../../../helpers/gameplay-store-test";
import {
  getRunProgressStoreView,
  resetRunDomainStore,
  setRunProgress,
} from "../../../../helpers/run-domain-store-test";

const mockedClearSave = vi.mocked(clearAlchemySaveData);

beforeEach(() => {
  mockedClearSave.mockReset();
  mockedClearSave.mockResolvedValue(true);
  useProfileStore.setState(useProfileStore.getInitialState());
  useSettingsStore.setState(useSettingsStore.getInitialState());
  resetRunDomainStore();
  resetTransientRunUi();
});

describe("clearAllPersistentGameData", () => {
  it("wipes app, run permanent data, and homestead after a successful disk clear", async () => {
    useRunProfileStore.getState().addMaterials({ wood: 10, iron: 0, herbs: 0, food: 0, crystal: 0 });
    setRunProgress({ unlockedTalents: { physical: ["test-talent"] } });
    useProfileStore.getState().setDiscoveredCardIds(["card-a"]);

    await expect(clearAllPersistentGameData()).resolves.toBe(true);

    expect(useRunProfileStore.getState().materialInventory).toEqual({
      wood: 0,
      iron: 0,
      herbs: 0,
      food: 0,
      crystal: 0,
    });
    expect(getRunProgressStoreView().unlockedTalents).toEqual({});
    expect(useProfileStore.getState().discoveredCardIds).toEqual(defaultSaveData.discoveredCardIds);
    expect(useProfileStore.getState().discoveredCardIds).not.toContain("card-a");
  });

  it("leaves memory intact when the disk wipe fails", async () => {
    mockedClearSave.mockResolvedValue(false);
    useRunProfileStore.getState().addMaterials({ wood: 10, iron: 0, herbs: 0, food: 0, crystal: 0 });
    setRunProgress({ unlockedTalents: { physical: ["test-talent"] } });
    useProfileStore.getState().setDiscoveredCardIds(["card-a"]);

    await expect(clearAllPersistentGameData()).resolves.toBe(false);

    expect(useRunProfileStore.getState().materialInventory.wood).toBe(10);
    expect(getRunProgressStoreView().unlockedTalents).toEqual({ physical: ["test-talent"] });
    expect(useProfileStore.getState().discoveredCardIds).toContain("card-a");
  });
});
