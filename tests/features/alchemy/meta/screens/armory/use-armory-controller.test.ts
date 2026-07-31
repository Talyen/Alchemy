// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useArmoryController } from "@/features/alchemy/meta/screens/armory/use-armory-controller";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";
import { getRunDomainStore } from "@/features/alchemy/shared/stores/run-domain-store";
import { getRunTransientStore } from "@/features/alchemy/shared/stores/run-transient-store";
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

  it("flushes saves after transferring gear outside an active run", () => {
    const helm: GearInstance = { instanceId: "helm-a", definitionId: "leather-helm-basic", affixes: [] };
    const inventories = createEmptyGearInventories();
    inventories.knight = [helm];
    useGearStore.getState().initialize(inventories, useGearStore.getState().loadouts);

    const { result } = renderHook(() => useArmoryController());

    act(() => {
      expect(result.current.onTransferGear(helm.instanceId, "rogue")).toBe(true);
    });

    expect(flushAlchemySaveNow).toHaveBeenCalledWith(null);
  });

  it("syncs health for the active-run character when editing another loadout", () => {
    const helm: GearInstance = {
      instanceId: "rogue-health-helm",
      definitionId: "leather-helm-basic",
      affixes: [{ id: "max-health", value: 7 }],
    };
    const inventories = createEmptyGearInventories();
    inventories.rogue = [helm];
    useGearStore.getState().initialize(inventories, useGearStore.getState().loadouts);
    getRunDomainStore().initialize(null, "knight");
    getRunDomainStore().setRunMaxHealth(30);
    getRunDomainStore().setRunPlayerHealth(30);
    getRunTransientStore().setHasActiveRun(true);

    const { result } = renderHook(() => useArmoryController());

    act(() => {
      result.current.onEquip("rogue", "helm", helm);
    });

    expect(getRunDomainStore().activeRun.runMaxHealth).toBe(30);
    expect(getRunDomainStore().activeRun.runPlayerHealth).toBe(30);

    getRunTransientStore().setHasActiveRun(false);
  });

  it("moves board items through the controller facade", () => {
    const helm: GearInstance = { instanceId: "helm-a", definitionId: "leather-helm-basic", affixes: [] };
    const inventories = createEmptyGearInventories();
    inventories.knight = [helm];
    useGearStore.getState().initialize(inventories, useGearStore.getState().loadouts);

    const { result } = renderHook(() => useArmoryController());

    act(() => {
      result.current.onMoveBoardItem("knight", { kind: "gear", id: helm.instanceId }, 2, 1);
    });

    expect(useGearStore.getState().boardPositionsByCharacter.knight[helm.instanceId]).toEqual({ col: 2, row: 1 });
  });

  it("flushes saves after changed board moves only", () => {
    const helm: GearInstance = { instanceId: "helm-a", definitionId: "leather-helm-basic", affixes: [] };
    const inventories = createEmptyGearInventories();
    inventories.knight = [helm];
    useGearStore.getState().initialize(inventories, useGearStore.getState().loadouts);

    const { result } = renderHook(() => useArmoryController());

    act(() => {
      expect(result.current.onMoveBoardItem("knight", { kind: "gear", id: helm.instanceId }, 2, 1)).toBe(true);
    });
    expect(flushAlchemySaveNow).toHaveBeenCalledTimes(1);

    act(() => {
      expect(result.current.onMoveBoardItem("knight", { kind: "gear", id: "missing-id" }, 3, 1)).toBe(false);
    });
    expect(flushAlchemySaveNow).toHaveBeenCalledTimes(1);
  });
});
