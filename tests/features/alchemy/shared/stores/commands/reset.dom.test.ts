import {
  mutateRunForTest,
  setBattleActiveForTest as setHasActiveBattle,
  resetProfileForTest,
  resetRunDomainStore,
  setRunProgress,
} from "../../../../../helpers/run-domain-store-test";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/alchemy/shared/storage/io", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/shared/storage/io")>();
  return {
    ...actual,
    clearAlchemySaveData: vi.fn(),
  };
});
import { clearAlchemySaveData } from "@/features/alchemy/shared/storage/io";
import {
  defaultSaveData,
  DEVICE_DISPLAY_STORAGE_KEY,
  readDeviceDisplayPreferences,
} from "@/features/alchemy/shared/storage";
import {
  flushDeviceDisplayPreferences,
  initDeviceDisplayPreferences,
  useDeviceDisplayStore,
} from "@/features/alchemy/shared/stores/react/device-display-store";
import { readProfileStore } from "@/features/alchemy/shared/stores/session/profile-store";
import { clearAllPersistentGameData, resetTransientRunUi } from "@/features/alchemy/shared/stores/commands/reset";
import {
  readActiveRun,
  readActiveRunScreen,
  readBattle,
  readRunProfile,
  readRunSession,
} from "@/features/alchemy/shared/stores/session/run-reads";
import {
  addMaterialsToStockpile,
  setDiscoveredCardIds,
  setHasActiveRun,
} from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { useSettingsStore } from "@/features/alchemy/shared/stores/react/settings-store";
import { useUiStore } from "@/features/alchemy/shared/stores/react/ui-store";
import { emptyInventory } from "@/lib/homestead/inventory";
import { ROUTE_SCREENS } from "@/lib/routing";
import { defaultGameSession } from "@/app/application-session";
import { deferred } from "../../../../../helpers/deferred";

const mockedClearSave = vi.mocked(clearAlchemySaveData);

beforeEach(() => {
  mockedClearSave.mockReset();
  mockedClearSave.mockResolvedValue(true);
  resetProfileForTest();
  useSettingsStore.getState().resetToDefaults();
  resetRunDomainStore();
  resetTransientRunUi(defaultGameSession);
  localStorage.removeItem(DEVICE_DISPLAY_STORAGE_KEY);
  initDeviceDisplayPreferences();
});

describe("clearAllPersistentGameData", () => {
  it("clears progression and live combat together while preserving device display sizes", async () => {
    mutateRunForTest((draft) => {
      addMaterialsToStockpile(draft, { wood: 10, iron: 0, herbs: 0, food: 0, gems: 0, stone: 0, hide: 0 });
      setDiscoveredCardIds(draft, ["card-a"]);
      setHasActiveRun(draft, true);
      setHasActiveBattle(draft, true);
    });
    setRunProgress({ unlockedTalents: { physical: ["test-talent"] } });
    useUiStore.getState().setShowClearSaveConfirm(true);
    useDeviceDisplayStore.getState().setGameSizePercent(85);
    useDeviceDisplayStore.getState().setTooltipSizePercent(120);
    flushDeviceDisplayPreferences();

    await expect(clearAllPersistentGameData(defaultGameSession)).resolves.toBe(true);

    expect(mockedClearSave).toHaveBeenCalledWith("localWipe", defaultGameSession);
    expect(readRunProfile(defaultGameSession).materialInventory).toEqual(emptyInventory());
    expect(readRunProfile(defaultGameSession).unlockedTalents).toEqual({});
    expect(readProfileStore(defaultGameSession).discoveredCardIds).toEqual(defaultSaveData.discoveredCardIds);
    expect(readProfileStore(defaultGameSession).discoveredCardIds).not.toContain("card-a");
    expect(readRunSession(defaultGameSession).hasActiveRun).toBe(false);
    expect(readBattle(defaultGameSession).hasActiveBattle).toBe(false);
    expect(readActiveRun(defaultGameSession).roomsEncountered).toBe(0);
    expect(readActiveRunScreen(defaultGameSession)).toBe(ROUTE_SCREENS.MENU);
    // The dialog is transient UI and closes with the wipe; device sizes live
    // outside the versioned save and survive it (Reset Options is their reset).
    expect(useUiStore.getState().showClearSaveConfirm).toBe(false);
    expect(useDeviceDisplayStore.getState()).toMatchObject({ gameSizePercent: 85, tooltipSizePercent: 120 });
    expect(readDeviceDisplayPreferences()).toMatchObject({ gameSizePercent: 85, tooltipSizePercent: 120 });
  });

  it("rejects a second clear while the disk operation is pending, then releases the guard after failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const disk = deferred<boolean>();
    mockedClearSave.mockReturnValueOnce(disk.promise);
    useUiStore.getState().setShowClearSaveConfirm(true);
    const first = clearAllPersistentGameData(defaultGameSession);
    await expect(clearAllPersistentGameData(defaultGameSession)).resolves.toBe(false);
    expect(mockedClearSave).toHaveBeenCalledOnce();
    expect(useUiStore.getState().showClearSaveConfirm).toBe(true);
    disk.resolve(false);
    await expect(first).resolves.toBe(false);
    await expect(clearAllPersistentGameData(defaultGameSession)).resolves.toBe(true);
    expect(mockedClearSave).toHaveBeenCalledTimes(2);
    expect(useUiStore.getState().showClearSaveConfirm).toBe(false);
  });

  it("leaves memory intact when the disk wipe fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedClearSave.mockResolvedValue(false);
    useUiStore.getState().setShowClearSaveConfirm(true);
    mutateRunForTest((draft) => {
      addMaterialsToStockpile(draft, { wood: 10, iron: 0, herbs: 0, food: 0, gems: 0, stone: 0, hide: 0 });
      setDiscoveredCardIds(draft, ["card-a"]);
    });
    setRunProgress({ unlockedTalents: { physical: ["test-talent"] } });

    await expect(clearAllPersistentGameData(defaultGameSession)).resolves.toBe(false);

    expect(readRunProfile(defaultGameSession).materialInventory.wood).toBe(10);
    expect(readRunProfile(defaultGameSession).unlockedTalents).toEqual({ physical: ["test-talent"] });
    expect(readProfileStore(defaultGameSession).discoveredCardIds).toContain("card-a");
    expect(useUiStore.getState().showClearSaveConfirm).toBe(true);
  });
});
