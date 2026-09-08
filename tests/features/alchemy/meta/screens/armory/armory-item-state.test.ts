import { describe, expect, it } from "vitest";
import {
  formatTrinketEquipAriaLabel,
  getArmoryTargetState,
  PROTECTED_BEFORE_SALVAGE_MESSAGE,
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

  it("blocks protected items from salvage with a shared message", () => {
    const state = getArmoryTargetState({
      instance: sword({ protected: true }),
      salvageMode: true,
      activeCurrencyId: null,
    });
    expect(state.salvageable).toBe(false);
    expect(state.blockedReason).toBe(PROTECTED_BEFORE_SALVAGE_MESSAGE);
    expect(state.targetAriaLabel).toBeNull();
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
