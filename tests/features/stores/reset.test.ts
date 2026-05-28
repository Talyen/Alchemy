import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/features/alchemy/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/storage")>();
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
  },
}));

import { clearAllPersistentGameData, resetActiveRunStores } from "@/features/alchemy/stores/reset";
import { useAppStore } from "@/features/alchemy/stores/app-store";
import { useBattleStore } from "@/features/alchemy/stores/battle-store";
import { useHomesteadStore } from "@/features/alchemy/stores/homestead-store";
import { useRunStore } from "@/features/alchemy/stores/run-store";
import { useScreenStore } from "@/features/alchemy/stores/screen-store";
import { createEmptyRewardState } from "@/features/alchemy/navigation/reward-flow";
import { defaultSaveData } from "@/features/alchemy/storage";

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState());
  useBattleStore.setState(useBattleStore.getInitialState());
  useHomesteadStore.setState(useHomesteadStore.getInitialState());
  useRunStore.setState(useRunStore.getInitialState());
  useScreenStore.setState(useScreenStore.getInitialState());
});

describe("resetActiveRunStores", () => {
  it("clears battle + run + screen transient state", () => {
    useBattleStore.getState().setHasActiveBattle(true);
    useRunStore.setState({ runGold: 99, roomsEncountered: 5 });
    useScreenStore.setState({
      hasActiveRun: true,
      rewardState: { ...createEmptyRewardState(), goldReward: 10 },
      mysteryEvent: { id: "test", title: "T", description: "D", choices: [] },
    });

    resetActiveRunStores();

    expect(useBattleStore.getState().hasActiveBattle).toBe(false);
    expect(useRunStore.getState().runGold).toBe(0);
    expect(useRunStore.getState().roomsEncountered).toBe(0);
    expect(useScreenStore.getState().hasActiveRun).toBe(false);
    expect(useScreenStore.getState().rewardState).toEqual(createEmptyRewardState());
    expect(useScreenStore.getState().mysteryEvent).toBeNull();
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
    useRunStore.setState({ unlockedTalents: { physical: ["test-talent"] } });
    useAppStore.getState().setDiscoveredCardIds(["card-a"]);

    clearAllPersistentGameData();

    expect(useHomesteadStore.getState().materialInventory).toEqual(
      useHomesteadStore.getInitialState().materialInventory,
    );
    expect(useRunStore.getState().unlockedTalents).toEqual({});
    expect(useAppStore.getState().discoveredCardIds).toEqual(defaultSaveData.discoveredCardIds);
    expect(useAppStore.getState().discoveredCardIds).not.toContain("card-a");
  });
});
