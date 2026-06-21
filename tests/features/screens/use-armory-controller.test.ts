// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useArmoryController } from "@/features/alchemy/meta/screens/armory/use-armory-controller";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";
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
});
