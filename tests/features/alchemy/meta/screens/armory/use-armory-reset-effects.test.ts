// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { useArmoryResetEffects } from "@/features/alchemy/meta/screens/armory/use-armory-reset-effects";
import type { ArmorySalvagePending } from "@/features/alchemy/meta/screens/armory/armory-screen-types";
import { EMPTY_CRAFTING_CURRENCIES, type GearInstance } from "@/lib/gear";

const instance = { instanceId: "gear-sword" } as GearInstance;
const pending = {
  instance,
  yield: { currencies: EMPTY_CRAFTING_CURRENCIES, materials: { iron: 1 } },
} as ArmorySalvagePending;

function useHarness({
  editable,
  voidstone,
  inventoryHasItem,
}: {
  editable: boolean;
  voidstone: number;
  inventoryHasItem: boolean;
}) {
  const [salvageMode, setSalvageMode] = useState(true);
  const [salvagePending, setSalvagePending] = useState<ArmorySalvagePending | null>(pending);
  const [activeCurrencyId, setActiveCurrencyId] = useState<"voidstone" | null>("voidstone");
  const inventoryById = new Map<string, GearInstance>(inventoryHasItem ? [["gear-sword", instance]] : []);

  useArmoryResetEffects({
    editable,
    craftingCurrencies: { ...EMPTY_CRAFTING_CURRENCIES, voidstone },
    activeCurrencyId,
    characterId: "knight",
    inventoryById,
    salvagePending,
    salvageMode,
    setSalvageMode,
    setSalvagePending,
    setActiveCurrencyId,
  });

  return { salvageMode, salvagePending, activeCurrencyId };
}

describe("useArmoryResetEffects", () => {
  it("clears targeting when the armory is not editable", () => {
    const { result } = renderHook(() => useHarness({ editable: false, voidstone: 1, inventoryHasItem: true }));

    expect(result.current.salvageMode).toBe(false);
    expect(result.current.salvagePending).toBeNull();
    expect(result.current.activeCurrencyId).toBeNull();
  });

  it("clears a depleted currency without touching salvage", () => {
    const { result } = renderHook(() => useHarness({ editable: true, voidstone: 0, inventoryHasItem: true }));

    expect(result.current.salvageMode).toBe(true);
    expect(result.current.salvagePending).toEqual(pending);
    expect(result.current.activeCurrencyId).toBeNull();
  });

  it("clears salvage pending when the item leaves inventory", () => {
    const { result } = renderHook(() => useHarness({ editable: true, voidstone: 1, inventoryHasItem: false }));

    expect(result.current.salvagePending).toBeNull();
    expect(result.current.salvageMode).toBe(true);
    expect(result.current.activeCurrencyId).toBe("voidstone");
  });
});
