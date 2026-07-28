import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/features/alchemy/shared/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/shared/storage")>();
  return {
    ...actual,
    clearAlchemySaveData: vi.fn(),
  };
});

vi.mock("@/lib/platform", () => ({
  platform: {
    isDesktop: false,
    canQuit: false,
    setDisplayMode: vi.fn(),
    quit: vi.fn(),
    steam: { isInitialized: false, playerName: null, init: vi.fn(), setRichPresence: vi.fn() },
    cloud: { isAvailable: false, read: vi.fn(), write: vi.fn() },
    storage: { removeLocal: vi.fn().mockResolvedValue({ ok: true }) },
  },
}));

import { clearAllPersistentGameData, resetActiveRunStores } from "@/features/alchemy/shared/stores/reset";
import { useProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import { useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { createEmptyRewardState } from "@/features/alchemy/run-loop/navigation/reward-flow";
import { defaultSaveData } from "@/features/alchemy/shared/storage";
import { useRunDomainStore } from "@/features/alchemy/shared/stores/run-domain-store";
import {
  getBattleStoreView,
  getRunProgressStoreView,
  getRunSessionStoreView,
  resetRunDomainStore,
  setRunProgress,
  setRunSession,
} from "../../../../helpers/run-domain-store-test";

beforeEach(() => {
  useProfileStore.setState(useProfileStore.getInitialState());
  useSettingsStore.setState(useSettingsStore.getInitialState());
  resetRunDomainStore();
  resetTransientRunUi();
});

describe("resetActiveRunStores", () => {
  it("clears battle + run + screen transient state", () => {
    getBattleStoreView().setHasActiveBattle(true);
    setRunProgress({ runGold: 99, roomsEncountered: 5 });
    setRunSession({
      hasActiveRun: true,
      rewardState: { ...createEmptyRewardState(), gold: 10 },
      mysteryEvent: { id: "test", title: "T", art: "", narrative: "", choices: [] },
    });

    resetActiveRunStores();

    expect(getBattleStoreView().hasActiveBattle).toBe(false);
    expect(getRunProgressStoreView().runGold).toBe(0);
    expect(getRunProgressStoreView().roomsEncountered).toBe(0);
    expect(getRunSessionStoreView().hasActiveRun).toBe(false);
    expect(getRunSessionStoreView().rewardState).toEqual(createEmptyRewardState());
    expect(getRunSessionStoreView().mysteryEvent).toBeNull();
  });

  it("does not reset homestead or app options", () => {
    useRunDomainStore.getState().addMaterials({ wood: 5, iron: 0, herbs: 0, food: 0, crystal: 0 });
    useSettingsStore.getState().setMusicVol(0.25);
    const homesteadBefore = useRunDomainStore.getState().profile.materialInventory.wood;
    const musicBefore = useSettingsStore.getState().musicVol;

    resetActiveRunStores();

    expect(useRunDomainStore.getState().profile.materialInventory.wood).toBe(homesteadBefore);
    expect(useSettingsStore.getState().musicVol).toBe(musicBefore);
  });
});

describe("clearAllPersistentGameData", () => {
  it("wipes app, run permanent data, and homestead", () => {
    useRunDomainStore.getState().addMaterials({ wood: 10, iron: 0, herbs: 0, food: 0, crystal: 0 });
    setRunProgress({ unlockedTalents: { physical: ["test-talent"] } });
    useProfileStore.getState().setDiscoveredCardIds(["card-a"]);

    clearAllPersistentGameData();

    expect(useRunDomainStore.getState().profile.materialInventory).toEqual({
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
});
