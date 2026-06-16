import { describe, expect, it } from "vitest";
import {
  canSalvageGear,
  computeGearManifest,
  createEmptyGearLoadouts,
  createGearInstance,
  defaultGearEffects,
  effectsForInstance,
  equipGear,
  formatSalvageValue,
  gearDefinitions,
  isGearCompatibleWithSlot,
  isTwoHanded,
  modifiersToAffixIds,
  normalizeExclusiveGearLoadouts,
  normalizeGearInstance,
  normalizeGearLoadout,
  pruneOrphanGearLoadouts,
  resolveAffixEffects,
  rollAffixCount,
  rollAffixes,
  rollGearRarity,
  salvageGear,
  unequipGear,
  type GearInstance,
  GEAR_DEFINITION_IDS,
  GEAR_SLOTS,
} from "@/lib/gear";

const ring: GearInstance = { instanceId: "ring-1", definitionId: "placeholder-ring", affixIds: [] };

function manifestWithPhysical(amount: number) {
  return { ...defaultGearEffects, flatPhysicalDamage: amount };
}

describe("gear domain", () => {
  it("keeps Gear slots and definitions separate from Trinkets", () => {
    expect(GEAR_SLOTS.some((slot) => slot.includes("trinket"))).toBe(false);
    expect(GEAR_DEFINITION_IDS).not.toContain("placeholder-trinket");
  });

  it("allows one ring instance in either ring slot, but not both on one class", () => {
    expect(isGearCompatibleWithSlot(gearDefinitions[ring.definitionId], "left-ring")).toBe(true);
    expect(isGearCompatibleWithSlot(gearDefinitions[ring.definitionId], "right-ring")).toBe(true);

    const left = equipGear(createEmptyGearLoadouts(), "knight", "left-ring", ring, [ring]);
    expect(left.knight["left-ring"]).toBe(ring.instanceId);
    const right = equipGear(left, "knight", "right-ring", ring, [ring]);
    expect(right.knight["left-ring"]).toBeNull();
    expect(right.knight["right-ring"]).toBe(ring.instanceId);
  });

  it("moves the same instance between classes", () => {
    const knight = equipGear(createEmptyGearLoadouts(), "knight", "left-ring", ring, [ring]);
    const rogue = equipGear(knight, "rogue", "right-ring", ring, [ring]);
    expect(rogue.knight["left-ring"]).toBeNull();
    expect(rogue.rogue["right-ring"]).toBe(ring.instanceId);
  });

  it("returns unchanged loadouts for unknown definition or incompatible slot", () => {
    const loadouts = createEmptyGearLoadouts();
    expect(
      equipGear(loadouts, "knight", "body", {
        instanceId: "x",
        definitionId: "not-a-gear-id",
        affixIds: [],
      }, []),
    ).toBe(loadouts);

    expect(
      equipGear(loadouts, "knight", "helm", {
        instanceId: "body-1",
        definitionId: "placeholder-body",
        affixIds: [],
      }, []),
    ).toBe(loadouts);
  });

  it("aggregates one physical damage per equipped placeholder", () => {
    const body: GearInstance = { instanceId: "body-1", definitionId: "placeholder-body", affixIds: [] };
    let loadouts = equipGear(createEmptyGearLoadouts(), "knight", "body", body, [body, ring]);
    loadouts = equipGear(loadouts, "knight", "left-ring", ring, [body, ring]);
    expect(computeGearManifest("knight", [body, ring], loadouts)).toEqual(manifestWithPhysical(2));
  });

  it("aggregates affix effects by damage type", () => {
    const item: GearInstance = {
      instanceId: "gear-1",
      definitionId: "ruby-ring-basic",
      affixIds: ["flat-burn-1", "flat-freeze-1", "flat-burn-1"],
    };
    expect(effectsForInstance(item)).toEqual({
      ...defaultGearEffects,
      flatBurnDamage: 2,
      flatFreezeDamage: 1,
    });
  });

  it("normalizes legacy physical modifiers into affix ids", () => {
    expect(modifiersToAffixIds([{ kind: "flatPhysicalDamage", value: 2 }])).toEqual([
      "flat-physical-1",
      "flat-physical-1",
    ]);
    expect(resolveAffixEffects(modifiersToAffixIds([{ kind: "flatPhysicalDamage", value: 2 }]))).toEqual(
      manifestWithPhysical(2),
    );
  });

  it("rolls basic and astral affix counts in range", () => {
    expect(rollAffixCount("basic", () => 0)).toBe(1);
    expect(rollAffixCount("basic", () => 0.99)).toBe(2);
    expect(rollAffixCount("astral", () => 0)).toBe(3);
    expect(rollAffixCount("astral", () => 0.99)).toBe(4);
  });

  it("weights affinity-matching affixes higher", () => {
    const definition = gearDefinitions["ruby-ring-basic"];
    const rolls = Array.from({ length: 40 }, (_, index) => index / 40);
    const selections = rolls.map((roll) => rollAffixes(definition, 1, () => roll)[0]);
    expect(selections.filter((affixId) => affixId === "flat-burn-1").length).toBeGreaterThan(
      selections.filter((affixId) => affixId === "flat-physical-1").length,
    );
  });

  it("rolls rarity by enemy type with deterministic rng", () => {
    expect(rollGearRarity("normal", () => 0.1)).toBe("basic");
    expect(rollGearRarity("normal", () => 0.9)).toBe("astral");
    expect(rollGearRarity("elite", () => 0.4)).toBe("basic");
    expect(rollGearRarity("elite", () => 0.6)).toBe("astral");
    expect(rollGearRarity("boss", () => 0.2)).toBe("basic");
    expect(rollGearRarity("boss", () => 0.8)).toBe("astral");
  });

  it("clears off-hand when equipping a two-handed main-hand weapon", () => {
    const staff = createGearInstance(gearDefinitions["staff-basic"], ["flat-burn-1"]);
    const shield: GearInstance = {
      instanceId: "shield-1",
      definitionId: "leather-shield-basic",
      affixIds: [],
    };
    let loadouts = equipGear(createEmptyGearLoadouts(), "knight", "off-hand", shield, [staff, shield]);
    loadouts = equipGear(loadouts, "knight", "main-hand", staff, [staff, shield]);
    expect(isTwoHanded(gearDefinitions["staff-basic"])).toBe(true);
    expect(loadouts.knight["main-hand"]).toBe(staff.instanceId);
    expect(loadouts.knight["off-hand"]).toBeNull();
  });

  it("clears two-handed main-hand when equipping off-hand", () => {
    const staff = createGearInstance(gearDefinitions["staff-basic"], ["flat-burn-1"]);
    const shield: GearInstance = {
      instanceId: "shield-1",
      definitionId: "leather-shield-basic",
      affixIds: [],
    };
    let loadouts = equipGear(createEmptyGearLoadouts(), "knight", "main-hand", staff, [staff, shield]);
    loadouts = equipGear(loadouts, "knight", "off-hand", shield, [staff, shield]);
    expect(loadouts.knight["main-hand"]).toBeNull();
    expect(loadouts.knight["off-hand"]).toBe(shield.instanceId);
  });

  it("skips orphan loadout references and missing definitions in manifest", () => {
    const body: GearInstance = { instanceId: "body-1", definitionId: "placeholder-body", affixIds: [] };
    const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "body", body, [body]);
    loadouts.knight.helm = "missing-instance";
    expect(computeGearManifest("knight", [body], loadouts)).toEqual(manifestWithPhysical(1));
  });

  it("applies instance affixes on top of definition effects", () => {
    const body: GearInstance = {
      instanceId: "body-1",
      definitionId: "placeholder-body",
      affixIds: ["flat-physical-1", "flat-physical-1"],
    };
    const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "body", body, [body]);
    expect(computeGearManifest("knight", [body], loadouts)).toEqual(manifestWithPhysical(3));
  });

  it("ignores legacy modifiers when affixIds are present", () => {
    const normalized = normalizeGearInstance({
      instanceId: "gear-1",
      definitionId: "placeholder-ring",
      affixIds: ["flat-physical-1"],
      modifiers: [{ kind: "flatPhysicalDamage", value: 2 }],
    });
    expect(normalized?.affixIds).toEqual(["flat-physical-1"]);
  });

  it("rejects equipping gear that is not in inventory", () => {
    const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "left-ring", ring, []);
    expect(loadouts.knight["left-ring"]).toBeNull();
  });

  it("formats salvage values for display", () => {
    expect(formatSalvageValue({ wood: 0, iron: 1, herbs: 0, food: 0, crystal: 0 })).toBe("Salvage for 1 Iron");
  });

  it("only salvages unequipped gear for its configured materials", () => {
    const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "left-ring", ring, [ring]);
    expect(salvageGear([ring], loadouts, ring.instanceId)).toBeNull();
    const unequipped = unequipGear(loadouts, "knight", "left-ring");
    expect(salvageGear([ring], unequipped, ring.instanceId)).toEqual({
      inventory: [],
      materials: { wood: 0, iron: 1, herbs: 0, food: 0, crystal: 0 },
    });
  });

  it("reports salvage eligibility via canSalvageGear", () => {
    const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "left-ring", ring, [ring]);
    expect(canSalvageGear(loadouts, ring.instanceId)).toBe(false);
    expect(canSalvageGear(unequipGear(loadouts, "knight", "left-ring"), ring.instanceId)).toBe(true);
  });

  it("normalizes partial loadouts and exclusive references", () => {
    const partial = normalizeGearLoadout({ body: "body-1", "trinket-1": "old" });
    expect(partial.body).toBe("body-1");
    expect(partial).not.toHaveProperty("trinket-1");

    const exclusive = normalizeExclusiveGearLoadouts({
      ...createEmptyGearLoadouts(),
      knight: { ...createEmptyGearLoadouts().knight, "left-ring": "ring-1" },
      rogue: { ...createEmptyGearLoadouts().rogue, "right-ring": "ring-1" },
    });
    expect(exclusive.knight["left-ring"]).toBe("ring-1");
    expect(exclusive.rogue["right-ring"]).toBeNull();
  });

  it("prunes loadout references missing from inventory", () => {
    const inventory = [ring];
    const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "left-ring", ring, [ring]);
    const pruned = pruneOrphanGearLoadouts([], loadouts);
    expect(pruned.knight["left-ring"]).toBeNull();
    expect(pruneOrphanGearLoadouts(inventory, loadouts).knight["left-ring"]).toBe("ring-1");
  });
});
