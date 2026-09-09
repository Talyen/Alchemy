import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useArmoryController } from "@/features/alchemy/meta/screens/armory/use-armory-controller";
import { mutateGearForTest, resetAllTestStores } from "../../../../../helpers/gameplay-store-test";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  setHasActiveBattle,
  setHasActiveRun,
  setMaterials,
  setRunMaxHealth,
  setRunPlayerHealth,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { initializeActiveRun } from "@/features/alchemy/shared/stores/write-port-run";
import { readActiveRun, readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
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
    resetAllTestStores();
    vi.clearAllMocks();
  });

  it("flushes saves after salvaging gear outside an active run", () => {
    const armor: GearInstance = { instanceId: "armor-a", definitionId: "plate-armor-basic", affixes: [] };
    const inventories = createEmptyGearInventories();
    inventories.knight = [armor];
    mutateGearForTest((gear) => gear.initialize(inventories, gear.loadouts));

    const { result } = renderHook(() => useArmoryController());
    const salvageYield = computeSalvageYield(armor);

    act(() => {
      dispatchRunSessionCommand((draft) => setMaterials(draft, emptyInventory()));
      expect(result.current.onSalvage(armor.instanceId, salvageYield)).toBe(true);
    });

    expect(flushSaveAfterGearMutation).toHaveBeenCalledWith(null);
    expect(readRunProfile().materialInventory.iron).toBe(9);
    expect(readActiveRun().runMaterialsEarned.iron).toBe(0);
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
    const armor: GearInstance = { instanceId: "armor-run", definitionId: "plate-armor-basic", affixes: [] };
    const inventories = createEmptyGearInventories();
    inventories.knight = [armor];
    mutateGearForTest((gear) => gear.initialize(inventories, gear.loadouts));
    dispatchRunSessionCommand((draft) => {
      initializeActiveRun(draft, null, "knight");
      setHasActiveRun(draft, true);
      setMaterials(draft, emptyInventory());
    });

    const { result } = renderHook(() => useArmoryController());
    const salvageYield = computeSalvageYield(armor);

    act(() => {
      expect(result.current.onSalvage(armor.instanceId, salvageYield)).toBe(true);
    });

    expect(readRunProfile().materialInventory.iron).toBe(9);
    expect(readActiveRun().runMaterialsEarned.iron).toBe(9);

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

  it("rejects equipment changes without flushing during an active battle", () => {
    const armor: GearInstance = { instanceId: "armor-locked", definitionId: "plate-armor-basic", affixes: [] };
    const inventories = createEmptyGearInventories();
    inventories.knight = [armor];
    mutateGearForTest((gear) => gear.initialize(inventories, gear.loadouts));
    dispatchRunSessionCommand((draft) => {
      setHasActiveRun(draft, true);
      setHasActiveBattle(draft, true);
    });

    const { result } = renderHook(() => useArmoryController());
    expect(result.current.combatRestrictions.characters.knight).toEqual(["campaign"]);

    act(() => {
      result.current.onEquip("knight", "body", armor);
    });

    expect(readGearState().loadouts.knight.body).toBeNull();
    expect(flushSaveAfterGearMutation).not.toHaveBeenCalled();

    dispatchRunSessionCommand((draft) => setHasActiveBattle(draft, false));
  });

  it("flushes after successful equip, unequip, trinket, and currency mutations", () => {
    const armor: GearInstance = { instanceId: "armor-flush", definitionId: "plate-armor-basic", affixes: [] };
    const sword: GearInstance = {
      instanceId: "sword-flush",
      definitionId: "shortsword-basic",
      affixes: [{ id: "flat-physical", value: 1 }],
    };
    const inventories = createEmptyGearInventories();
    inventories.knight = [armor, sword];
    mutateGearForTest((gear) => {
      gear.initialize(inventories, gear.loadouts);
      gear.addTrinket("bone-charm");
      gear.addCurrencies({ voidstone: 1 });
    });

    const { result } = renderHook(() => useArmoryController({ rng: () => 0 }));

    act(() => {
      result.current.onEquip("knight", "body", armor);
    });
    expect(flushSaveAfterGearMutation).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.onUnequip("knight", "body");
    });
    expect(flushSaveAfterGearMutation).toHaveBeenCalledTimes(2);

    act(() => {
      result.current.onEquipTrinket("knight", "bone-charm");
    });
    expect(flushSaveAfterGearMutation).toHaveBeenCalledTimes(3);

    act(() => {
      result.current.onUnequipTrinket("knight");
    });
    expect(flushSaveAfterGearMutation).toHaveBeenCalledTimes(4);

    act(() => {
      expect(result.current.onApplyCurrency("voidstone", sword.instanceId)).toBe(true);
    });
    expect(flushSaveAfterGearMutation).toHaveBeenCalledTimes(5);
  });

  it("does not flush when salvage or currency mutations fail", () => {
    const inventories = createEmptyGearInventories();
    mutateGearForTest((gear) => gear.initialize(inventories, gear.loadouts));

    const { result } = renderHook(() => useArmoryController());

    act(() => {
      expect(result.current.onSalvage("missing", { currencies: {}, materials: {} } as never)).toBe(false);
    });
    expect(flushSaveAfterGearMutation).not.toHaveBeenCalled();

    act(() => {
      expect(result.current.onApplyCurrency("voidstone", "missing")).toBe(false);
    });
    expect(flushSaveAfterGearMutation).not.toHaveBeenCalled();
  });
});
