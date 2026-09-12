import { useArmoryTargetingState } from "@/features/alchemy/meta/screens/armory/use-armory-targeting-state";
import { EMPTY_CRAFTING_CURRENCIES, computeSalvageYield, type GearInstance } from "@/lib/gear";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const instance: GearInstance = { instanceId: "sword-1", definitionId: "shortsword-basic", affixes: [] };
const pending = { instance, yield: computeSalvageYield(instance) };
const initialProps = {
  editable: true,
  characterId: "knight" as const,
  craftingCurrencies: { ...EMPTY_CRAFTING_CURRENCIES, voidstone: 1 },
  inventoryById: new Map([[instance.instanceId, instance]]),
};

describe("Armory targeting transitions", () => {
  it("switches exclusively between currency, salvage, and confirmation, then clears", () => {
    const { result } = renderHook(() => useArmoryTargetingState(initialProps));
    act(() => result.current.selectCurrency("voidstone"));
    expect(result.current.activeCurrencyId).toBe("voidstone");
    act(() => result.current.toggleSalvage());
    expect(result.current).toMatchObject({ salvageMode: true, activeCurrencyId: null, salvagePending: null });
    act(() => result.current.confirmSalvage(pending));
    expect(result.current).toMatchObject({ salvageMode: false, activeCurrencyId: null, salvagePending: pending });
    act(() => result.current.clearTargeting());
    expect(result.current).toMatchObject({ salvageMode: false, activeCurrencyId: null, salvagePending: null });
  });

  it("clears targeting when combat locks the character or currency is depleted", () => {
    const { result, rerender } = renderHook(useArmoryTargetingState, { initialProps });
    act(() => result.current.selectCurrency("voidstone"));
    rerender({ ...initialProps, craftingCurrencies: EMPTY_CRAFTING_CURRENCIES });
    expect(result.current.activeCurrencyId).toBeNull();
    rerender(initialProps);
    expect(result.current.activeCurrencyId).toBeNull();
    act(() => result.current.toggleSalvage());
    rerender({ ...initialProps, editable: false });
    expect(result.current.salvageMode).toBe(false);
  });

  it("dismisses confirmation when its item leaves inventory", () => {
    const { result, rerender } = renderHook(useArmoryTargetingState, { initialProps });
    act(() => result.current.confirmSalvage(pending));
    rerender({ ...initialProps, inventoryById: new Map() });
    expect(result.current.salvagePending).toBeNull();
  });
});
