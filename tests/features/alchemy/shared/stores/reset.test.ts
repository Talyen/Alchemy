import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/features/alchemy/shared/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/shared/storage")>();
  return {
    ...actual,
    clearAlchemySaveData: vi.fn(),
  };
});

import { clearAlchemySaveData, defaultSaveData } from "@/features/alchemy/shared/storage";
import { DEVICE_DISPLAY_STORAGE_KEY, readDeviceDisplayPreferences } from "@/features/alchemy/shared/storage";
import { clearAllPersistentGameData, resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { readProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import {
  flushDeviceDisplayPreferences,
  initDeviceDisplayPreferences,
  useDeviceDisplayStore,
} from "@/features/alchemy/shared/stores/device-display-store";
import { ROUTE_SCREENS } from "@/lib/routing";
import {
  readActiveRun,
  readActiveRunScreen,
  readBattle,
  readRunProfile,
  readRunSession,
} from "@/features/alchemy/shared/stores/run-reads";
import { useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import { emptyInventory } from "@/lib/homestead/inventory";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  addMaterialsToStockpile,
  setDiscoveredCardIds,
  setHasActiveBattle,
  setHasActiveRun,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { resetProfileForTest, resetRunDomainStore, setRunProgress } from "../../../../helpers/run-domain-store-test";

const mockedClearSave = vi.mocked(clearAlchemySaveData);

beforeEach(() => {
  mockedClearSave.mockReset();
  mockedClearSave.mockResolvedValue(true);
  resetProfileForTest();
  useSettingsStore.setState(useSettingsStore.getInitialState());
  resetRunDomainStore();
  resetTransientRunUi();
  localStorage.removeItem(DEVICE_DISPLAY_STORAGE_KEY);
  initDeviceDisplayPreferences();
});

describe("clearAllPersistentGameData", () => {
  it("wipes app, run permanent data, and homestead after a successful disk clear", async () => {
    dispatchRunSessionCommand((draft) => {
      addMaterialsToStockpile(draft, { wood: 10, iron: 0, herbs: 0, food: 0, gems: 0, stone: 0, hide: 0 });
      setDiscoveredCardIds(draft, ["card-a"]);
    });
    setRunProgress({ unlockedTalents: { physical: ["test-talent"] } });

    await expect(clearAllPersistentGameData()).resolves.toBe(true);

    expect(mockedClearSave).toHaveBeenCalledWith("localWipe");
    expect(readRunProfile().materialInventory).toEqual(emptyInventory());
    expect(readRunProfile().unlockedTalents).toEqual({});
    expect(readProfileStore().discoveredCardIds).toEqual(defaultSaveData.discoveredCardIds);
    expect(readProfileStore().discoveredCardIds).not.toContain("card-a");
  });

  it("tears down the live run, session, and battle alongside the wipe", async () => {
    dispatchRunSessionCommand((draft) => {
      setHasActiveRun(draft, true);
      setHasActiveBattle(draft, true);
    });

    await expect(clearAllPersistentGameData()).resolves.toBe(true);

    expect(readRunSession().hasActiveRun).toBe(false);
    expect(readBattle().hasActiveBattle).toBe(false);
    expect(readActiveRun().roomsEncountered).toBe(0);
    expect(readActiveRunScreen()).toBe(ROUTE_SCREENS.MENU);
  });

  it("closes the clear-save dialog but preserves device display sizes on wipe", async () => {
    useUiStore.getState().setShowClearSaveConfirm(true);
    useDeviceDisplayStore.getState().setGameSizePercent(85);
    useDeviceDisplayStore.getState().setTooltipSizePercent(120);
    flushDeviceDisplayPreferences();

    await expect(clearAllPersistentGameData()).resolves.toBe(true);

    // The dialog is transient UI and closes with the wipe; device sizes live
    // outside the versioned save and survive it (Reset Options is their reset).
    expect(useUiStore.getState().showClearSaveConfirm).toBe(false);
    expect(useDeviceDisplayStore.getState()).toMatchObject({ gameSizePercent: 85, tooltipSizePercent: 120 });
    expect(readDeviceDisplayPreferences()).toMatchObject({ gameSizePercent: 85, tooltipSizePercent: 120 });
  });

  it("leaves memory intact when the disk wipe fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedClearSave.mockResolvedValue(false);
    useUiStore.getState().setShowClearSaveConfirm(true);
    dispatchRunSessionCommand((draft) => {
      addMaterialsToStockpile(draft, { wood: 10, iron: 0, herbs: 0, food: 0, gems: 0, stone: 0, hide: 0 });
      setDiscoveredCardIds(draft, ["card-a"]);
    });
    setRunProgress({ unlockedTalents: { physical: ["test-talent"] } });

    await expect(clearAllPersistentGameData()).resolves.toBe(false);

    expect(readRunProfile().materialInventory.wood).toBe(10);
    expect(readRunProfile().unlockedTalents).toEqual({ physical: ["test-talent"] });
    expect(readProfileStore().discoveredCardIds).toContain("card-a");
    expect(useUiStore.getState().showClearSaveConfirm).toBe(true);
  });
});
