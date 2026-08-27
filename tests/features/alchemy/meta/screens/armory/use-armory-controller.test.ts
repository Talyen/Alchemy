// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useArmoryController } from "@/features/alchemy/meta/screens/armory/use-armory-controller";
import { mutateGearForTest, resetGearForTest } from "../../../../../helpers/gameplay-store-test";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  setHasActiveBattle,
  setMaterials,
  setRunMaxHealth,
  setRunPlayerHealth,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { setHasActiveRun } from "@/features/alchemy/shared/stores/write-port-session";
import { initializeActiveRun } from "@/features/alchemy/shared/stores/write-port-run";
import { readActiveRun, readRunProfile } from "@/features/alchemy/shared/stores/run-session-read-port";
import { readGearState } from "@/features/alchemy/shared/stores/gear-store";
import { computeSalvageYield, createEmptyGearInventories, type GearInstance } from "@/lib/gear";
import { emptyInventory } from "@/lib/homestead/inventory";
import { flushSaveAfterGearMutation } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";

vi.mock("@/app/app-screen-chrome-context", () => ({
  useAppScreenChrome: () => ({ returnToRunScreen: null }),
}));

vi.mock("@/features/alchemy/shared/stores/run-session-lifecycle-port", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/shared/stores/run-session-lifecycle-port")>();
  return {
    ...actual,
    flushSaveAfterGearMutation: vi.fn(),
  };
});

describe("useArmoryController", () => {
  beforeEach(() => {
    resetGearForTest();
    vi.clearAllMocks();
  });

  it("flushes saves after salvaging gear outside an active run", () => {
    const armor: GearInstance = { instanceId: "armor-a", definitionId: "leather-armor-basic", affixes: [] };
    const inventories = createEmptyGearInventories();
    inventories.knight = [armor];
    mutateGearForTest((gear) => gear.initialize(inventories, gear.loadouts));

    const { result } = renderHook(() => useArmoryController());
    const salvageYield = computeSalvageYield(armor, () => 0);

    act(() => {
      dispatchRunSessionCommand((draft) => setMaterials(draft, emptyInventory()));
      expect(result.current.onSalvage(armor.instanceId, salvageYield)).toBe(true);
    });

    expect(flushSaveAfterGearMutation).toHaveBeenCalledWith(null);
    expect(readRunProfile().materialInventory.herbs).toBe(6);
    expect(readActiveRun().runMaterialsEarned.herbs).toBe(0);
  });

  it("syncs health for the active-run character when editing another loadout", () => {
    const armor: GearInstance = {
      instanceId: "rogue-health-armor",
      definitionId: "leather-armor-basic",
      affixes: [{ id: "max-health", value: 7 }],
    };
    const inventories = createEmptyGearInventories();
    inventories.rogue = [armor];
    mutateGearForTest((gear) => gear.initialize(inventories, gear.loadouts));
    dispatchRunSessionCommand((draft) => {
      initializeActiveRun(draft, null, "knight");
      setRunMaxHealth(draft, 30);
      setRunPlayerHealth(draft, 30);
      setHasActiveRun(draft, true);
    });

    const { result } = renderHook(() => useArmoryController());

    act(() => {
      result.current.onEquip("rogue", "body", armor);
    });

    expect(readActiveRun().runMaxHealth).toBe(30);
    expect(readActiveRun().runPlayerHealth).toBe(30);

    dispatchRunSessionCommand((draft) => setHasActiveRun(draft, false));
  });

  it("counts homestead salvage toward run-earned materials during an active run", () => {
    const armor: GearInstance = { instanceId: "armor-run", definitionId: "leather-armor-basic", affixes: [] };
    const inventories = createEmptyGearInventories();
    inventories.knight = [armor];
    mutateGearForTest((gear) => gear.initialize(inventories, gear.loadouts));
    dispatchRunSessionCommand((draft) => {
      initializeActiveRun(draft, null, "knight");
      setHasActiveRun(draft, true);
      setMaterials(draft, emptyInventory());
    });

    const { result } = renderHook(() => useArmoryController());
    const salvageYield = computeSalvageYield(armor, () => 0);

    act(() => {
      expect(result.current.onSalvage(armor.instanceId, salvageYield)).toBe(true);
    });

    expect(readRunProfile().materialInventory.herbs).toBe(6);
    expect(readActiveRun().runMaterialsEarned.herbs).toBe(6);

    dispatchRunSessionCommand((draft) => setHasActiveRun(draft, false));
  });

  it("spawns dev gear through the HP-sync command path", () => {
    const inventories = createEmptyGearInventories();
    mutateGearForTest((gear) => gear.initialize(inventories, gear.loadouts));

    const { result } = renderHook(() => useArmoryController());
    expect(result.current.onSpawnDevGear).toEqual(expect.any(Function));

    act(() => {
      result.current.onSpawnDevGear?.("knight");
    });

    expect(readGearState().inventories.knight).toHaveLength(1);
    expect(flushSaveAfterGearMutation).toHaveBeenCalled();
  });

  it("keeps Armory editable during an active battle", () => {
    const armor: GearInstance = { instanceId: "armor-locked", definitionId: "leather-armor-basic", affixes: [] };
    const inventories = createEmptyGearInventories();
    inventories.knight = [armor];
    mutateGearForTest((gear) => gear.initialize(inventories, gear.loadouts));
    dispatchRunSessionCommand((draft) => setHasActiveBattle(draft, true));

    const { result } = renderHook(() => useArmoryController());
    expect(result.current.browseOnly).toBe(false);

    act(() => {
      result.current.onEquip("knight", "body", armor);
    });

    expect(readGearState().loadouts.knight.body).toBe(armor.instanceId);
    expect(flushSaveAfterGearMutation).toHaveBeenCalled();

    dispatchRunSessionCommand((draft) => setHasActiveBattle(draft, false));
  });
});
