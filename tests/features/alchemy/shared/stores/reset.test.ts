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
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import { useHomesteadStore } from "@/features/alchemy/shared/stores/homestead-store";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { createEmptyRewardState } from "@/features/alchemy/run-loop/navigation/reward-flow";
import { defaultSaveData } from "@/features/alchemy/shared/storage";
import {
  getBattleStoreView,
  getRunProgressStoreView,
  getRunSessionStoreView,
  resetRunDomainStore,
  setRunProgress,
  setRunSession,
} from "../../../../helpers/run-domain-store-test";

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState());
  resetRunDomainStore();
  useHomesteadStore.setState(useHomesteadStore.getInitialState());
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
    useHomesteadStore.getState().addMaterials({ wood: 5, iron: 0, herbs: 0, food: 0, crystal: 0 });
    useAppStore.getState().setMusicVol(0.25);
    const homesteadBefore = useHomesteadStore.getState().materialInventory.wood;
    const musicBefore = useAppStore.getState().musicVol;

    resetActiveRunStores();

    expect(useHomesteadStore.getState().materialInventory.wood).toBe(homesteadBefore);
    expect(useAppStore.getState().musicVol).toBe(musicBefore);
  });
});

describe("clearAllPersistentGameData", () => {
  it("wipes app, run permanent data, and homestead", () => {
    useHomesteadStore.getState().addMaterials({ wood: 10, iron: 0, herbs: 0, food: 0, crystal: 0 });
    setRunProgress({ unlockedTalents: { physical: ["test-talent"] } });
    useAppStore.getState().setDiscoveredCardIds(["card-a"]);

    clearAllPersistentGameData();

    expect(useHomesteadStore.getState().materialInventory).toEqual(
      useHomesteadStore.getInitialState().materialInventory,
    );
    expect(getRunProgressStoreView().unlockedTalents).toEqual({});
    expect(useAppStore.getState().discoveredCardIds).toEqual(defaultSaveData.discoveredCardIds);
    expect(useAppStore.getState().discoveredCardIds).not.toContain("card-a");
  });
});
