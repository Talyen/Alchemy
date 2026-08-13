// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useArmoryController } from "@/features/alchemy/meta/screens/armory/use-armory-controller";
import { useGearStore } from "../../../../../helpers/gameplay-store-test";
import { getRunDomainStore, getRunTransientStore } from "../../../../../helpers/gameplay-store-test";
import { createEmptyGearInventories, type GearInstance } from "@/lib/gear";
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

    act(() => {
      expect(result.current.onSalvage(armor.instanceId)).toBe(true);
    });

    expect(flushAlchemySaveNow).toHaveBeenCalledWith(null);
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
});
