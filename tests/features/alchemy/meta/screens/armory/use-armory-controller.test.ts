import { setRunProgressActivity } from "@/features/alchemy/shared/stores/run-session-write-port";
import { setBattleActiveForTest as setHasActiveBattle } from "../../../../../helpers/run-domain-store-test";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useArmoryController } from "@/features/alchemy/meta/screens/armory/use-armory-controller";
import { mutateGearForTest, resetAllTestStores } from "../../../../../helpers/run-domain-store-test";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  setHasActiveRun,
  setMaterials,
  setRunMaxHealth,
  setRunPlayerHealth,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { initializeActiveRun } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActiveRun, readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
import { readGearState } from "@/features/alchemy/shared/stores/gear-store";
import { createEmptyGearInventories, type GearInstance } from "@/lib/gear";
import { computeSalvageYield, EMPTY_CRAFTING_CURRENCIES } from "@/lib/gear";
import { emptyInventory } from "@/lib/homestead/inventory";
import { flushSaveAfterGearMutation } from "@/features/alchemy/shared/stores/run-lifecycle";
import { defaultGameSession } from "@/app/application-session";

vi.mock("@/app/app-screen-chrome-context", () => ({
  useAppScreenChrome: () => ({ returnToRunScreen: null }),
}));

vi.mock("@/features/alchemy/shared/stores/run-lifecycle", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/shared/stores/run-lifecycle")>();
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

    act(() => {
      dispatchRunSessionCommand(
        (draft) => acceptCommand(setMaterials(draft, emptyInventory())),
        undefined,
        defaultGameSession,
      );
      expect(result.current.onSalvage(armor.instanceId)).toBe(true);
    });

    expect(flushSaveAfterGearMutation).toHaveBeenCalledWith(null, defaultGameSession);
    expect(readRunProfile(defaultGameSession).materialInventory.iron).toBe(9);
    expect(readActiveRun(defaultGameSession).runMaterialsEarned.iron).toBe(0);
    expect(readActiveRun(defaultGameSession).runCurrenciesEarned).toEqual(EMPTY_CRAFTING_CURRENCIES);
  });

  it("uses the current run state when flushing after a controller rerender", () => {
    const armor: GearInstance = { instanceId: "rerender-armor", definitionId: "plate-armor-basic", affixes: [] };
    const inventories = createEmptyGearInventories();
    inventories.knight = [armor];
    mutateGearForTest((gear) => gear.initialize(inventories, gear.loadouts));
    const { result } = renderHook(() => useArmoryController());
    act(() => {
      dispatchRunSessionCommand(
        (draft) => {
          initializeActiveRun(draft, null, "knight");
          setHasActiveRun(draft, true);
          setRunProgressActivity(draft, "destination");

          return acceptCommand();
        },
        undefined,
        defaultGameSession,
      );
    });
    act(() => {
      expect(result.current.onEquip("knight", "body", armor)).toBe(true);
    });
    expect(flushSaveAfterGearMutation).toHaveBeenLastCalledWith(
      expect.objectContaining({ characterId: "knight" }),
      defaultGameSession,
    );
    act(() =>
      dispatchRunSessionCommand((draft) => acceptCommand(setHasActiveRun(draft, false)), undefined, defaultGameSession),
    );
    act(() => result.current.onUnequip("knight", "body"));
    expect(flushSaveAfterGearMutation).toHaveBeenLastCalledWith(null, defaultGameSession);
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
    dispatchRunSessionCommand(
      (draft) => {
        initializeActiveRun(draft, null, "knight");
        setRunMaxHealth(draft, 30);
        setRunPlayerHealth(draft, 30);
        setHasActiveRun(draft, true);
        setRunProgressActivity(draft, "destination");

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );

    const { result } = renderHook(() => useArmoryController());

    act(() => {
      result.current.onEquip("rogue", "body", armor);
    });

    expect(readActiveRun(defaultGameSession).runMaxHealth).toBe(30);
    expect(readActiveRun(defaultGameSession).runPlayerHealth).toBe(30);

    dispatchRunSessionCommand((draft) => acceptCommand(setHasActiveRun(draft, false)), undefined, defaultGameSession);
  });

  it("counts homestead salvage toward run-earned materials during an active run", () => {
    const armor: GearInstance = { instanceId: "armor-run", definitionId: "plate-armor-basic", affixes: [] };
    const inventories = createEmptyGearInventories();
    inventories.knight = [armor];
    mutateGearForTest((gear) => gear.initialize(inventories, gear.loadouts));
    dispatchRunSessionCommand(
      (draft) => {
        initializeActiveRun(draft, null, "knight");
        setHasActiveRun(draft, true);
        setRunProgressActivity(draft, "destination");
        setMaterials(draft, emptyInventory());

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );

    const { result } = renderHook(() => useArmoryController());

    act(() => {
      expect(result.current.onSalvage(armor.instanceId)).toBe(true);
    });

    expect(readRunProfile(defaultGameSession).materialInventory.iron).toBe(9);
    expect(readActiveRun(defaultGameSession).runMaterialsEarned.iron).toBe(9);
    expect(readActiveRun(defaultGameSession).runCurrenciesEarned).toEqual(computeSalvageYield(armor).currencies);

    dispatchRunSessionCommand((draft) => acceptCommand(setHasActiveRun(draft, false)), undefined, defaultGameSession);
  });

  it("spawns dev gear through the HP-sync command path", () => {
    const inventories = createEmptyGearInventories();
    mutateGearForTest((gear) => gear.initialize(inventories, gear.loadouts));

    const { result } = renderHook(() => useArmoryController());
    expect(result.current.onSpawnDevGear).toEqual(expect.any(Function));

    act(() => {
      result.current.onSpawnDevGear?.("knight");
    });

    expect(readGearState(defaultGameSession).inventories.knight).toHaveLength(1);
    expect(flushSaveAfterGearMutation).toHaveBeenCalled();
  });

  it("rejects equipment changes without flushing during an active battle", () => {
    const armor: GearInstance = { instanceId: "armor-locked", definitionId: "plate-armor-basic", affixes: [] };
    const inventories = createEmptyGearInventories();
    inventories.knight = [armor];
    mutateGearForTest((gear) => gear.initialize(inventories, gear.loadouts));
    dispatchRunSessionCommand(
      (draft) => {
        setHasActiveRun(draft, true);
        setRunProgressActivity(draft, "destination");
        setHasActiveBattle(draft, true);

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );

    const { result } = renderHook(() => useArmoryController());
    expect(result.current.combatRestrictions.characters.knight).toEqual(["campaign"]);

    act(() => {
      expect(result.current.onEquip("knight", "body", armor)).toBe(false);
    });

    expect(readGearState(defaultGameSession).loadouts.knight.body).toBeNull();
    expect(flushSaveAfterGearMutation).not.toHaveBeenCalled();

    dispatchRunSessionCommand(
      (draft) => acceptCommand(setHasActiveBattle(draft, false)),
      undefined,
      defaultGameSession,
    );
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
      expect(result.current.onEquip("knight", "body", armor)).toBe(true);
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
      expect(result.current.onSalvage("missing")).toBe(false);
    });
    expect(flushSaveAfterGearMutation).not.toHaveBeenCalled();

    act(() => {
      expect(result.current.onApplyCurrency("voidstone", "missing")).toBe(false);
    });
    expect(flushSaveAfterGearMutation).not.toHaveBeenCalled();
  });
});
