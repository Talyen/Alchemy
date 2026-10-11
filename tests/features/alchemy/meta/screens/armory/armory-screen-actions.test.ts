import "../../../../../helpers/mock-audio";
import { applyCurrencyToGear } from "@/features/alchemy/meta/screens/armory/armory-screen-actions";
import { playUISound } from "@/lib/audio";
import { type GearInstance } from "@/lib/gear";
import { describe, expect, it, vi } from "vitest";

function basicSword(): GearInstance {
  return { instanceId: "sword-1", definitionId: "shortsword-basic", affixes: [{ id: "flat-physical", value: 1 }] };
}

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

  it("disarms a successful craft immediately without clearing a newer selection after saving", () => {
    const pending: Array<() => void> = [];
    let mode = "currency";
    const onApplyCurrency = vi.fn().mockReturnValue(true);
    const clearCurrency = vi.fn(() => {
      mode = "idle";
    });
    applyCurrencyToGear({
      editable: true,
      activeCurrencyId: "voidstone",
      instance: basicSword(),
      onApplyCurrency,
      clearCurrency,
      afterProgressSaved: (run) => pending.push(run),
    });
    expect(mode).toBe("idle");
    expect(playUISound).not.toHaveBeenCalledWith("craft");
    mode = "salvage";
    pending.shift()!();
    expect(mode).toBe("salvage");
    expect(playUISound).toHaveBeenCalledWith("craft");
    expect(clearCurrency).toHaveBeenCalledTimes(1);
  });
});
