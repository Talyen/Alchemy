import { describe, expect, it } from "vitest";
import {
  createEmptyGearLoadouts,
  computeGearManifest,
  applyGearModifiers,
  equipGear,
  formatSalvageValue,
  getEquippedGearEffects,
  gearDefinitions,
  isGearCompatibleWithSlot,
  salvageGear,
  unequipGear,
  type GearInstance,
} from "@/lib/gear";

const ring: GearInstance = { instanceId: "ring-1", definitionId: "placeholder-ring", modifiers: [] };

describe("gear domain", () => {
  it("allows one ring instance in either ring slot, but not both on one class", () => {
    expect(isGearCompatibleWithSlot(gearDefinitions[ring.definitionId], "left-ring")).toBe(true);
    expect(isGearCompatibleWithSlot(gearDefinitions[ring.definitionId], "right-ring")).toBe(true);

    const left = equipGear(createEmptyGearLoadouts(), "knight", "left-ring", ring);
    expect(left.knight["left-ring"]).toBe(ring.instanceId);
    const right = equipGear(left, "knight", "right-ring", ring);
    expect(right.knight["left-ring"]).toBeNull();
    expect(right.knight["right-ring"]).toBe(ring.instanceId);
  });

  it("allows the same instance on different classes", () => {
    const knight = equipGear(createEmptyGearLoadouts(), "knight", "left-ring", ring);
    const rogue = equipGear(knight, "rogue", "right-ring", ring);
    expect(rogue.knight["left-ring"]).toBe(ring.instanceId);
    expect(rogue.rogue["right-ring"]).toBe(ring.instanceId);
  });

  it("aggregates one physical damage per equipped placeholder", () => {
    const body: GearInstance = { instanceId: "body-1", definitionId: "placeholder-body", modifiers: [] };
    let loadouts = equipGear(createEmptyGearLoadouts(), "knight", "body", body);
    loadouts = equipGear(loadouts, "knight", "left-ring", ring);
    expect(computeGearManifest("knight", [body, ring], loadouts)).toEqual({ flatPhysicalDamage: 2 });
    expect(getEquippedGearEffects("knight", [body, ring], loadouts)).toEqual({ flatPhysicalDamage: 2 });
  });

  it("applies instance modifiers on top of definition effects", () => {
    const body: GearInstance = {
      instanceId: "body-1",
      definitionId: "placeholder-body",
      modifiers: [{ kind: "flatPhysicalDamage", value: 2 }],
    };
    const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "body", body);
    expect(computeGearManifest("knight", [body], loadouts)).toEqual({ flatPhysicalDamage: 3 });
    expect(applyGearModifiers({ flatPhysicalDamage: 1 }, [{ kind: "flatPhysicalDamage", value: 2 }])).toEqual({
      flatPhysicalDamage: 3,
    });
  });

  it("formats salvage values for display", () => {
    expect(formatSalvageValue({ wood: 0, iron: 1, herbs: 0, food: 0, crystal: 0 })).toBe("Salvage for 1 Iron");
  });

  it("only salvages unequipped gear for its configured materials", () => {
    const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "left-ring", ring);
    expect(salvageGear([ring], loadouts, ring.instanceId)).toBeNull();
    const unequipped = unequipGear(loadouts, "knight", "left-ring");
    expect(salvageGear([ring], unequipped, ring.instanceId)).toEqual({
      inventory: [],
      materials: { wood: 0, iron: 1, herbs: 0, food: 0, crystal: 0 },
    });
  });
});
