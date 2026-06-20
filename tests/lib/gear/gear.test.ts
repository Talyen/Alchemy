import { describe, expect, it } from "vitest";
import {
  canSalvageGear,
  computeGearManifest,
  createEmptyGearLoadouts,
  createGearInstance,
  defaultGearEffects,
  effectsForInstance,
  equipGear,
  gearDefinitions,
  getGearAffixDisplayName,
  getGearAffixTooltipEntries,
  getGearInstanceTooltipEntries,
  isGearCompatibleWithLoadoutSlot,
  isGearCompatibleWithSlot,
  isQuiver,
  isRangedWeapon,
  isTwoHanded,
  legacyFlatPhysicalModifiersToAffixRolls,
  normalizeExclusiveGearLoadouts,
  normalizeGearInstance,
  normalizeGearLoadout,
  pruneOrphanGearLoadouts,
  resolveAffixEffects,
  rollAffixCount,
  salvageGear,
  unequipGear,
  type GearInstance,
  type GearLoadouts,
  GEAR_DEFINITION_IDS,
  GEAR_SLOTS,
} from "@/lib/gear";

const ring: GearInstance = { instanceId: "ring-1", definitionId: "ruby-ring-basic", affixes: [] };

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
      equipGear(
        loadouts,
        "knight",
        "body",
        {
          instanceId: "x",
          definitionId: "not-a-gear-id",
          affixes: [],
        },
        [],
      ),
    ).toBe(loadouts);

    expect(
      equipGear(
        loadouts,
        "knight",
        "helm",
        {
          instanceId: "body-1",
          definitionId: "leather-armor-basic",
          affixes: [],
        },
        [],
      ),
    ).toBe(loadouts);
  });

  it("aggregates equipped affix physical damage", () => {
    const body: GearInstance = {
      instanceId: "body-1",
      definitionId: "leather-armor-basic",
      affixes: [{ id: "flat-physical", value: 1 }],
    };
    const ringWithAffix: GearInstance = {
      instanceId: "ring-1",
      definitionId: "ruby-ring-basic",
      affixes: [{ id: "flat-physical", value: 1 }],
    };
    let loadouts = equipGear(createEmptyGearLoadouts(), "knight", "body", body, [body, ringWithAffix]);
    loadouts = equipGear(loadouts, "knight", "left-ring", ringWithAffix, [body, ringWithAffix]);
    expect(computeGearManifest("knight", [body, ringWithAffix], loadouts)).toEqual(manifestWithPhysical(2));
  });

  it("aggregates affix effects by damage type", () => {
    const item: GearInstance = {
      instanceId: "gear-1",
      definitionId: "ruby-ring-basic",
      affixes: [
        { id: "flat-burn", value: 1 },
        { id: "flat-freeze", value: 1 },
        { id: "flat-burn", value: 1 },
      ],
    };
    expect(effectsForInstance(item)).toEqual({
      ...defaultGearEffects,
      flatBurnDamage: 2,
      flatFreezeDamage: 1,
    });
  });

  it("normalizes legacy physical modifiers into affix rolls", () => {
    expect(legacyFlatPhysicalModifiersToAffixRolls([{ kind: "flatPhysicalDamage", value: 2 }])).toEqual([
      { id: "flat-physical", value: 1 },
      { id: "flat-physical", value: 1 },
    ]);
    expect(
      resolveAffixEffects(legacyFlatPhysicalModifiersToAffixRolls([{ kind: "flatPhysicalDamage", value: 2 }]), "basic"),
    ).toEqual(manifestWithPhysical(2));
  });

  it("rolls basic and astral affix counts with 80/20 min vs max weighting", () => {
    expect(rollAffixCount("basic", () => 0)).toBe(1);
    expect(rollAffixCount("basic", () => 0.79)).toBe(1);
    expect(rollAffixCount("basic", () => 0.8)).toBe(2);
    expect(rollAffixCount("basic", () => 0.99)).toBe(2);
    expect(rollAffixCount("astral", () => 0)).toBe(3);
    expect(rollAffixCount("astral", () => 0.79)).toBe(3);
    expect(rollAffixCount("astral", () => 0.8)).toBe(4);
    expect(rollAffixCount("astral", () => 0.99)).toBe(4);
  });

  it("clears off-hand when equipping a two-handed main-hand weapon", () => {
    const staff = createGearInstance(gearDefinitions["staff-basic"], [{ id: "flat-burn", value: 1 }]);
    const shield: GearInstance = {
      instanceId: "shield-1",
      definitionId: "leather-buckler-basic",
      affixes: [],
    };
    let loadouts = equipGear(createEmptyGearLoadouts(), "knight", "off-hand", shield, [staff, shield]);
    loadouts = equipGear(loadouts, "knight", "main-hand", staff, [staff, shield]);
    expect(isTwoHanded(gearDefinitions["staff-basic"])).toBe(true);
    expect(loadouts.knight["main-hand"]).toBe(staff.instanceId);
    expect(loadouts.knight["off-hand"]).toBeNull();
  });

  it("clears two-handed main-hand when equipping off-hand", () => {
    const staff = createGearInstance(gearDefinitions["staff-basic"], [{ id: "flat-burn", value: 1 }]);
    const shield: GearInstance = {
      instanceId: "shield-1",
      definitionId: "leather-buckler-basic",
      affixes: [],
    };
    let loadouts = equipGear(createEmptyGearLoadouts(), "knight", "main-hand", staff, [staff, shield]);
    loadouts = equipGear(loadouts, "knight", "off-hand", shield, [staff, shield]);
    expect(loadouts.knight["main-hand"]).toBeNull();
    expect(loadouts.knight["off-hand"]).toBe(shield.instanceId);
  });

  it("skips orphan loadout references and missing definitions in manifest", () => {
    const body: GearInstance = { instanceId: "body-1", definitionId: "leather-armor-basic", affixes: [] };
    const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "body", body, [body]);
    loadouts.knight.helm = "missing-instance";
    expect(computeGearManifest("knight", [body], loadouts)).toEqual(manifestWithPhysical(0));
  });

  it("applies instance affixes on top of definition effects", () => {
    const body: GearInstance = {
      instanceId: "body-1",
      definitionId: "leather-armor-basic",
      affixes: [
        { id: "flat-physical", value: 1 },
        { id: "flat-physical", value: 1 },
      ],
    };
    const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "body", body, [body]);
    expect(computeGearManifest("knight", [body], loadouts)).toEqual(manifestWithPhysical(2));
  });

  it("rejects malformed persisted gear instances", () => {
    expect(normalizeGearInstance(null)).toBeNull();
    expect(normalizeGearInstance({})).toBeNull();
    expect(normalizeGearInstance({ instanceId: 1, definitionId: "ruby-ring-basic" })).toBeNull();
    expect(normalizeGearInstance({ instanceId: "gear-1", definitionId: "not-a-gear-id" })).toBeNull();
  });

  it("ignores legacy modifiers when affix rolls are present", () => {
    const normalized = normalizeGearInstance({
      instanceId: "gear-1",
      definitionId: "ruby-ring-basic",
      affixIds: ["flat-physical-1"],
      modifiers: [{ kind: "flatPhysicalDamage", value: 2 }],
    });
    expect(normalized?.affixes).toEqual([{ id: "flat-physical", value: 1 }]);
  });

  it("migrates legacy affix ids to rolls", () => {
    const normalized = normalizeGearInstance({
      instanceId: "gear-1",
      definitionId: "ruby-ring-basic",
      affixIds: ["flat-physical-1", "flat-physical-1"],
    });
    expect(normalized?.affixes).toEqual([
      { id: "flat-physical", value: 1 },
      { id: "flat-physical", value: 1 },
    ]);
  });

  it("rejects equipping gear that is not in inventory", () => {
    const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "left-ring", ring, []);
    expect(loadouts.knight["left-ring"]).toBeNull();
  });

  it("salvages equipped gear for crafting currencies and clears loadouts", () => {
    const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "left-ring", ring, [ring]);
    const result = salvageGear([ring], loadouts, ring.instanceId, () => 0);
    expect(result?.inventory).toEqual([]);
    expect(result?.loadouts.knight["left-ring"]).toBeNull();
    expect(result?.yieldedCurrencies).toEqual({
      "discordant-dice": 1,
      "sprig-of-growth": 1,
      voidstone: 1,
      "ascension-seal": 0,
      "severance-maw": 0,
      "smiths-whetstone": 0,
    });
  });

  it("reports equipped gear as salvage eligible", () => {
    const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "left-ring", ring, [ring]);
    expect(canSalvageGear([ring], ring.instanceId)).toBe(true);
    expect(unequipGear(loadouts, "knight", "left-ring").knight["left-ring"]).toBeNull();
  });

  it("does not report nonexistent gear as salvage eligible", () => {
    expect(canSalvageGear([ring], "missing-ring")).toBe(false);
    expect(salvageGear([ring], createEmptyGearLoadouts(), "missing-ring", () => 0.5)).toBeNull();
  });

  it("normalizes partial loadouts and exclusive references", () => {
    const partial = normalizeGearLoadout({ body: "body-1" });
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

  it("reports gear max-health bonus from equipped loadout", () => {
    const body: GearInstance = {
      instanceId: "body-1",
      definitionId: "leather-armor-basic",
      affixes: [{ id: "max-health", value: 2 }],
    };
    const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "body", body, [body]);
    expect(computeGearManifest("knight", [body], loadouts).maxHealth).toBeGreaterThan(0);
  });

  it("normalizes legacy leather-hood definition ids to leather-helm", () => {
    const normalized = normalizeGearInstance({
      instanceId: "hood-1",
      definitionId: "leather-hood-basic",
      affixes: [{ id: "max-health", value: 1 }],
    });
    expect(normalized?.definitionId).toBe("leather-helm-basic");
  });

  it("normalizes legacy great-axe definition ids to double-axe", () => {
    const basic = normalizeGearInstance({
      instanceId: "axe-1",
      definitionId: "great-axe-basic",
      affixes: [],
    });
    const astral = normalizeGearInstance({
      instanceId: "axe-2",
      definitionId: "great-axe-astral",
      affixes: [],
    });
    expect(basic?.definitionId).toBe("double-axe-basic");
    expect(astral?.definitionId).toBe("double-axe-astral");
  });

  it("uses affix epithets for tooltip display names", () => {
    expect(getGearAffixDisplayName("flat-physical")).toBe("Ironbound");
    expect(getGearAffixDisplayName("gold-on-kill")).toBe("Greed");
  });

  it("builds structured affix tooltip entries with names", () => {
    const entries = getGearAffixTooltipEntries([{ id: "flat-physical", value: 2 }]);
    expect(entries).toEqual([
      {
        key: "flat-physical-0",
        name: "Ironbound",
        text: "Increases Physical damage by 2",
      },
    ]);
  });

  it("includes affix names in gear instance tooltip entries", () => {
    const entries = getGearInstanceTooltipEntries({
      instanceId: "helm-1",
      definitionId: "leather-helm-basic",
      affixes: [{ id: "flat-physical", value: 1 }],
    });
    expect(entries[0]?.name).toBe("Ironbound");
  });

  describe("ranged weapons and quivers", () => {
    const longbow: GearInstance = { instanceId: "longbow-1", definitionId: "longbow-basic", affixes: [] };
    const crossbow: GearInstance = { instanceId: "crossbow-1", definitionId: "crossbow-basic", affixes: [] };
    const longsword: GearInstance = { instanceId: "longsword-1", definitionId: "longsword-basic", affixes: [] };
    const quiver: GearInstance = { instanceId: "quiver-1", definitionId: "quiver-basic", affixes: [] };
    const buckler: GearInstance = { instanceId: "buckler-1", definitionId: "leather-buckler-basic", affixes: [] };

    it("flags longbow, shortbow, recurve-bow, and crossbow as ranged weapons", () => {
      expect(isRangedWeapon(gearDefinitions["longbow-basic"])).toBe(true);
      expect(isRangedWeapon(gearDefinitions["shortbow-basic"])).toBe(true);
      expect(isRangedWeapon(gearDefinitions["recurve-bow-basic"])).toBe(true);
      expect(isRangedWeapon(gearDefinitions["crossbow-basic"])).toBe(true);
      expect(isRangedWeapon(gearDefinitions["longsword-basic"])).toBe(false);
    });

    it("flags only quiver as a quiver base item", () => {
      expect(isQuiver(gearDefinitions["quiver-basic"])).toBe(true);
      expect(isQuiver(gearDefinitions["longsword-basic"])).toBe(false);
      expect(isQuiver(gearDefinitions["leather-buckler-basic"])).toBe(false);
    });

    it("marks all ranged weapons as one-handed (quiver is the off-hand)", () => {
      expect(isTwoHanded(gearDefinitions["longbow-basic"])).toBe(false);
      expect(isTwoHanded(gearDefinitions["shortbow-basic"])).toBe(false);
      expect(isTwoHanded(gearDefinitions["recurve-bow-basic"])).toBe(false);
      expect(isTwoHanded(gearDefinitions["crossbow-basic"])).toBe(false);
    });

    it("rejects equipping a quiver off-hand when no ranged main-hand is equipped", () => {
      const empty = createEmptyGearLoadouts();
      const inventory = [quiver];
      expect(
        isGearCompatibleWithLoadoutSlot(gearDefinitions["quiver-basic"], "off-hand", empty.knight, inventory),
      ).toBe(false);
      const result = equipGear(empty, "knight", "off-hand", quiver, inventory);
      expect(result.knight["off-hand"]).toBeNull();
    });

    it("accepts equipping a quiver off-hand when a bow main-hand is equipped", () => {
      const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "main-hand", longbow, [longbow]);
      expect(
        isGearCompatibleWithLoadoutSlot(gearDefinitions["quiver-basic"], "off-hand", loadouts.knight, [
          longbow,
          quiver,
        ]),
      ).toBe(true);
      const result = equipGear(loadouts, "knight", "off-hand", quiver, [longbow, quiver]);
      expect(result.knight["main-hand"]).toBe(longbow.instanceId);
      expect(result.knight["off-hand"]).toBe(quiver.instanceId);
    });

    it("accepts equipping a quiver off-hand when a crossbow main-hand is equipped", () => {
      const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "main-hand", crossbow, [crossbow]);
      const result = equipGear(loadouts, "knight", "off-hand", quiver, [crossbow, quiver]);
      expect(result.knight["main-hand"]).toBe(crossbow.instanceId);
      expect(result.knight["off-hand"]).toBe(quiver.instanceId);
    });

    it("rejects equipping a non-ranged main-hand when a quiver is in the off-hand", () => {
      const loadouts: GearLoadouts = createEmptyGearLoadouts();
      loadouts.knight["off-hand"] = quiver.instanceId;
      const inventory = [quiver, longsword];
      expect(
        isGearCompatibleWithLoadoutSlot(gearDefinitions["longsword-basic"], "main-hand", loadouts.knight, inventory),
      ).toBe(false);
      const result = equipGear(loadouts, "knight", "main-hand", longsword, inventory);
      expect(result.knight["main-hand"]).toBeNull();
      expect(result.knight["off-hand"]).toBe(quiver.instanceId);
    });

    it("resolveHandConflicts clears the off-hand quiver when a non-ranged main-hand is equipped", () => {
      const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "main-hand", longbow, [longbow]);
      const withQuiver = equipGear(loadouts, "knight", "off-hand", quiver, [longbow, quiver]);
      expect(withQuiver.knight["off-hand"]).toBe(quiver.instanceId);
      const withQuiverRemoved: GearLoadouts = {
        ...withQuiver,
        knight: { ...withQuiver.knight, "off-hand": null },
      };
      const swapped = equipGear(withQuiverRemoved, "knight", "main-hand", longsword, [longbow, quiver, longsword]);
      expect(swapped.knight["main-hand"]).toBe(longsword.instanceId);
      expect(swapped.knight["off-hand"]).toBeNull();
    });

    it("accepts equipping a buckler off-hand regardless of main-hand", () => {
      const inventory = [buckler];
      expect(
        isGearCompatibleWithLoadoutSlot(
          gearDefinitions["leather-buckler-basic"],
          "off-hand",
          createEmptyGearLoadouts().knight,
          inventory,
        ),
      ).toBe(true);
    });

    it("rejects equipping a buckler or other non-quiver off-hand when a ranged weapon is equipped in main-hand", () => {
      const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "main-hand", longbow, [longbow]);
      const inventory = [longbow, buckler];
      expect(
        isGearCompatibleWithLoadoutSlot(
          gearDefinitions["leather-buckler-basic"],
          "off-hand",
          loadouts.knight,
          inventory,
        ),
      ).toBe(false);
    });
  });
});
