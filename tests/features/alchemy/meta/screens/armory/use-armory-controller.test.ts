// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useArmoryController } from "@/features/alchemy/meta/screens/armory/use-armory-controller";
import { useGearStore } from "../../../../../helpers/gameplay-store-test";
import {
  getRunDomainStore,
  getRunProfileStore,
  getRunTransientStore,
} from "../../../../../helpers/gameplay-store-test";
import { computeSalvageYield, createEmptyGearInventories, type GearInstance } from "@/lib/gear";
import { emptyInventory } from "@/lib/homestead/inventory";
import { flushAlchemySaveNow } from "@/features/alchemy/shared/storage/flush-save";

vi.mock("@/app/app-screen-chrome-context", () => ({
  useAppScreenChrome: () => ({ returnToRunScreen: null }),
}));

vi.mock("@/features/alchemy/shared/storage/flush-save", () => ({
  flushAlchemySaveNow: vi.fn().mockResolvedValue(undefined),
}));

describe("useArmoryController", () => {
  beforeEach(() => {
    useGearStore.getState().reset();
    vi.clearAllMocks();
  });

  it("flushes saves after salvaging gear outside an active run", () => {
    const armor: GearInstance = { instanceId: "armor-a", definitionId: "leather-armor-basic", affixes: [] };
    const inventories = createEmptyGearInventories();
    inventories.knight = [armor];
    useGearStore.getState().initialize(inventories, useGearStore.getState().loadouts);

    const { result } = renderHook(() => useArmoryController());
    const salvageYield = computeSalvageYield(armor, () => 0);

    act(() => {
      getRunProfileStore().setMaterials(emptyInventory());
      expect(result.current.onSalvage(armor.instanceId, salvageYield)).toBe(true);
    });

    expect(flushAlchemySaveNow).toHaveBeenCalledWith(null);
    expect(getRunProfileStore().materialInventory.herbs).toBe(6);
    expect(getRunDomainStore().activeRun.runMaterialsEarned.herbs).toBe(0);
  });

  it("syncs health for the active-run character when editing another loadout", () => {
    const armor: GearInstance = {
      instanceId: "rogue-health-armor",
      definitionId: "leather-armor-basic",
      affixes: [{ id: "max-health", value: 7 }],
    };
    const inventories = createEmptyGearInventories();
    inventories.rogue = [armor];
    useGearStore.getState().initialize(inventories, useGearStore.getState().loadouts);
    getRunDomainStore().initialize(null, "knight");
    getRunDomainStore().setRunMaxHealth(30);
    getRunDomainStore().setRunPlayerHealth(30);
    getRunTransientStore().setHasActiveRun(true);

    const { result } = renderHook(() => useArmoryController());

    act(() => {
      result.current.onEquip("rogue", "body", armor);
    });

    expect(getRunDomainStore().activeRun.runMaxHealth).toBe(30);
    expect(getRunDomainStore().activeRun.runPlayerHealth).toBe(30);

    getRunTransientStore().setHasActiveRun(false);
  });

  it("counts homestead salvage toward run-earned materials during an active run", () => {
    const armor: GearInstance = { instanceId: "armor-run", definitionId: "leather-armor-basic", affixes: [] };
    const inventories = createEmptyGearInventories();
    inventories.knight = [armor];
    useGearStore.getState().initialize(inventories, useGearStore.getState().loadouts);
    getRunDomainStore().initialize(null, "knight");
    getRunTransientStore().setHasActiveRun(true);
    getRunProfileStore().setMaterials(emptyInventory());

    const { result } = renderHook(() => useArmoryController());
    const salvageYield = computeSalvageYield(armor, () => 0);

    act(() => {
      expect(result.current.onSalvage(armor.instanceId, salvageYield)).toBe(true);
    });

    expect(getRunProfileStore().materialInventory.herbs).toBe(6);
    expect(getRunDomainStore().activeRun.runMaterialsEarned.herbs).toBe(6);

    getRunTransientStore().setHasActiveRun(false);
  });
});
