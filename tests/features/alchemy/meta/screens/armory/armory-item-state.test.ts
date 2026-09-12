import { describe, expect, it } from "vitest";
import {
  formatTrinketEquipAriaLabel,
  getArmoryTargetState,
  getArmoryItemInteraction,
  reservedReasonFor,
} from "@/features/alchemy/meta/screens/armory/armory-item-state";
import type { GearInstance } from "@/lib/gear";

function sword(overrides?: Partial<GearInstance>): GearInstance {
  return {
    instanceId: "sword-1",
    definitionId: "shortsword-basic",
    affixes: [{ id: "flat-physical", value: 1 }],
    ...overrides,
  };
}

describe("armory-item-state", () => {
  it("builds reservation reasons with one template", () => {
    expect(reservedReasonFor(null)).toBeNull();
    expect(reservedReasonFor("knight")).toContain("Reserved for");
    expect(reservedReasonFor("knight")).toContain("until their battle ends.");
  });

  it("marks salvageable items with salvage mode and labels", () => {
    const state = getArmoryTargetState({ instance: sword(), salvageMode: true, activeCurrencyId: null });
    expect(state).toMatchObject({ salvageable: true, canCraft: false, mode: "salvage" });
    expect(state.targetAriaLabel).toContain("Salvage");
    expect(state.blockedReason).toBeNull();
  });

  it("blocks reserved items from crafting and salvage with the reservation reason", () => {
    const reserved = getArmoryTargetState({
      instance: sword(),
      salvageMode: true,
      activeCurrencyId: "voidstone",
      reservedBy: "knight",
    });
    expect(reserved.salvageable).toBe(false);
    expect(reserved.canCraft).toBe(false);
    expect(reserved.blockedReason).toContain("Reserved for");
    expect(reserved.mode).toBeNull();
  });

  it("formats trinket equip labels with prior owner", () => {
    expect(formatTrinketEquipAriaLabel("Bone Charm", null)).toBe("Equip Bone Charm");
    expect(formatTrinketEquipAriaLabel("Bone Charm", "knight")).toBe("Equip Bone Charm from knight");
  });
});

describe("Armory item interaction policy", () => {
  const base = { instance: sword(), salvageMode: false, activeCurrencyId: null, editable: true } as const;

  it("preserves locked equipment browsing while rejecting inventory changes", () => {
    expect(
      getArmoryItemInteraction({ ...base, editable: false, surface: { kind: "equipment", selected: false } }).action,
    ).toBe("select");
    expect(
      getArmoryItemInteraction({ ...base, editable: false, surface: { kind: "equipment", selected: true } }).action,
    ).toBe("combat-locked");
    expect(
      getArmoryItemInteraction({ ...base, editable: false, surface: { kind: "inventory", loadoutLegal: true } }).action,
    ).toBe("combat-locked");
  });

  it("prioritizes reservations over targeting and targeting over loadout compatibility", () => {
    const inventory = { ...base, salvageMode: true, surface: { kind: "inventory" as const, loadoutLegal: false } };
    expect(getArmoryItemInteraction(inventory)).toMatchObject({
      action: "salvage",
      salvageable: true,
      incompatible: false,
    });
    expect(getArmoryItemInteraction({ ...inventory, reservedBy: "knight" })).toMatchObject({
      action: "none",
      salvageable: false,
      ariaDisabled: true,
    });
    expect(getArmoryItemInteraction({ ...inventory, salvageMode: false })).toMatchObject({
      action: "incompatible",
      incompatible: true,
    });
  });

  it("keeps empty slots inert for salvage but browsable during currency targeting", () => {
    const slot = { ...base, instance: undefined, surface: { kind: "equipment" as const, selected: false } };
    expect(getArmoryItemInteraction({ ...slot, salvageMode: true }).action).toBe("none");
    expect(getArmoryItemInteraction({ ...slot, activeCurrencyId: "voidstone" }).action).toBe("select");
  });
});
