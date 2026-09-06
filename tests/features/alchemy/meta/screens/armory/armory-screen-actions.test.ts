import "../../../../../helpers/mock-audio";
import { describe, expect, it, vi } from "vitest";
import { playUISound } from "@/lib/audio";
import { type GearInstance } from "@/lib/gear";
import {
  applyCurrencyToGear,
  itemsMatchingSlot,
  resetArmoryTargeting,
} from "@/features/alchemy/meta/screens/armory/armory-screen-actions";

function basicSword(): GearInstance {
  return { instanceId: "sword-1", definitionId: "shortsword-basic", affixes: [{ id: "flat-physical", value: 1 }] };
}

function basicArmor(): GearInstance {
  return { instanceId: "armor-1", definitionId: "leather-armor-basic", affixes: [{ id: "max-health", value: 5 }] };
}

describe("itemsMatchingSlot", () => {
  it("keeps only items compatible with the slot", () => {
    expect(itemsMatchingSlot([basicSword(), basicArmor()], "main-hand").map((item) => item.instanceId)).toEqual([
      "sword-1",
    ]);
    expect(itemsMatchingSlot([basicSword(), basicArmor()], "body").map((item) => item.instanceId)).toEqual(["armor-1"]);
  });

  it("drops items with unknown definitions", () => {
    const unknown: GearInstance = { instanceId: "x-1", definitionId: "missing-definition", affixes: [] };
    expect(itemsMatchingSlot([unknown], "main-hand")).toEqual([]);
  });
});

describe("resetArmoryTargeting", () => {
  it("clears salvage, currency, and pending yield", () => {
    const setSalvageMode = vi.fn();
    const setActiveCurrencyId = vi.fn();
    const setSalvagePending = vi.fn();
    resetArmoryTargeting({ setSalvageMode, setActiveCurrencyId, setSalvagePending });
    expect(setSalvageMode).toHaveBeenCalledWith(false);
    expect(setActiveCurrencyId).toHaveBeenCalledWith(null);
    expect(setSalvagePending).toHaveBeenCalledWith(null);
  });

  it("works without a pending-yield setter", () => {
    const setSalvageMode = vi.fn();
    const setActiveCurrencyId = vi.fn();
    resetArmoryTargeting({ setSalvageMode, setActiveCurrencyId });
    expect(setSalvageMode).toHaveBeenCalledWith(false);
    expect(setActiveCurrencyId).toHaveBeenCalledWith(null);
  });
});

describe("applyCurrencyToGear", () => {
  it("does nothing when the board is not editable or no currency is armed", () => {
    const onApplyCurrency = vi.fn();
    const clearCurrency = vi.fn();
    applyCurrencyToGear({
      editable: false,
      activeCurrencyId: "voidstone",
      instance: basicSword(),
      onApplyCurrency,
      clearCurrency,
    });
    applyCurrencyToGear({
      editable: true,
      activeCurrencyId: null,
      instance: basicSword(),
      onApplyCurrency,
      clearCurrency,
    });
    expect(onApplyCurrency).not.toHaveBeenCalled();
    expect(playUISound).not.toHaveBeenCalled();
  });

  it("plays an error sound when the currency cannot apply to the item", () => {
    const onApplyCurrency = vi.fn();
    const clearCurrency = vi.fn();
    applyCurrencyToGear({
      editable: true,
      activeCurrencyId: "voidstone",
      instance: { ...basicSword(), affixes: [] },
      onApplyCurrency,
      clearCurrency,
    });
    expect(onApplyCurrency).not.toHaveBeenCalled();
    expect(playUISound).toHaveBeenCalledWith("error");
  });

  it("plays an error sound when the mutation fails", () => {
    const onApplyCurrency = vi.fn().mockReturnValue(false);
    const clearCurrency = vi.fn();
    applyCurrencyToGear({
      editable: true,
      activeCurrencyId: "voidstone",
      instance: basicSword(),
      onApplyCurrency,
      clearCurrency,
    });
    expect(onApplyCurrency).toHaveBeenCalledWith("voidstone", "sword-1");
    expect(playUISound).toHaveBeenCalledWith("error");
    expect(clearCurrency).not.toHaveBeenCalled();
  });

  it("clears the armed currency when the last one is spent", () => {
    const onApplyCurrency = vi.fn().mockReturnValue(true);
    const clearCurrency = vi.fn();
    applyCurrencyToGear({
      editable: true,
      activeCurrencyId: "voidstone",
      instance: basicSword(),
      onApplyCurrency,
      clearCurrency,
    });
    expect(playUISound).toHaveBeenCalledWith("talentUnlock");
    expect(clearCurrency).toHaveBeenCalledTimes(1);
  });

  it("clears targeting after one successful application", () => {
    const onApplyCurrency = vi.fn().mockReturnValue(true);
    const clearCurrency = vi.fn();
    applyCurrencyToGear({
      editable: true,
      activeCurrencyId: "voidstone",
      instance: basicSword(),
      onApplyCurrency,
      clearCurrency,
    });
    expect(clearCurrency).toHaveBeenCalledTimes(1);
  });
});
