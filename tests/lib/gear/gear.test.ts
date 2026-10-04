import { describe, expect, it } from "vitest";
import {
  computeSalvageYield,
  computeGearManifest,
  createEmptyGearLoadouts,
  defaultGearEffects,
  effectsForInstance,
  equipGear,
  gearDefinitions,
  isGearCompatibleWithLoadoutSlot,
  isGearCompatibleWithSlot,
  normalizeExclusiveGearLoadouts,
  normalizeGearInstance,
  normalizeGearLoadout,
  pruneOrphanGearLoadouts,
  salvageGear,
  unequipGear,
  type GearInstance,
  type GearLoadouts,
} from "@/lib/gear";
import { emptyInventory } from "@/lib/homestead/inventory";
import { makeGearInstance } from "../../helpers/gear-fixtures";

const ring: GearInstance = { instanceId: "ring-1", definitionId: "ruby-ring-basic", affixes: [] };

describe("gear domain", () => {
  it("allows one ring instance in either ring slot, but not both on one class", () => {
    expect(isGearCompatibleWithSlot(gearDefinitions[ring.definitionId], "left-accessory")).toBe(true);
    expect(isGearCompatibleWithSlot(gearDefinitions[ring.definitionId], "right-accessory")).toBe(true);

    const left = equipGear(createEmptyGearLoadouts(), "knight", "left-accessory", ring, [ring]);
    expect(left.knight["left-accessory"]).toBe(ring.instanceId);
    const right = equipGear(left, "knight", "right-accessory", ring, [ring]);
    expect(right.knight["left-accessory"]).toBeNull();
    expect(right.knight["right-accessory"]).toBe(ring.instanceId);
  });

  it("moves the same instance between classes", () => {
    const knight = equipGear(createEmptyGearLoadouts(), "knight", "left-accessory", ring, [ring]);
    const rogue = equipGear(knight, "rogue", "right-accessory", ring, [ring]);
    expect(rogue.knight["left-accessory"]).toBeNull();
    expect(rogue.rogue["right-accessory"]).toBe(ring.instanceId);
  });

  it("rejects missing items and incompatible slots without removing equipped Gear", () => {
    const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "left-accessory", ring, [ring]);
    expect(equipGear(loadouts, "ranger", "right-accessory", ring, [])).toBe(loadouts);
    expect(equipGear(loadouts, "ranger", "body", ring, [ring])).toBe(loadouts);
  });

  it("uses live inventory definitions when a stale transfer could displace another hand item", () => {
    const dagger = makeGearInstance("dagger-basic", "dagger-1");
    const shield = makeGearInstance("leather-buckler-basic", "shield-1");
    const inventory = [dagger, shield];
    let loadouts = equipGear(createEmptyGearLoadouts(), "rogue", "main-hand", dagger, inventory);
    loadouts = equipGear(loadouts, "knight", "off-hand", shield, inventory);
    const before = structuredClone(loadouts);
    const transferred = equipGear(
      loadouts,
      "knight",
      "main-hand",
      { ...dagger, definitionId: "staff-basic" },
      inventory,
    );
    expect(transferred.knight["main-hand"]).toBe(dagger.instanceId);
    expect(transferred.knight["off-hand"]).toBe(shield.instanceId);
    expect(transferred.rogue["main-hand"]).toBeNull();
    expect(loadouts).toEqual(before);
  });

  it("aggregates equipped bonuses once while ignoring another hero's Gear and orphan references", () => {
    const body = makeGearInstance("leather-armor-basic", "body", [
      { id: "flat-physical", value: 1 },
      { id: "max-health", value: 7 },
    ]);
    const accessory = { ...ring, affixes: [{ id: "flat-physical" as const, value: 1 }] };
    const other = makeGearInstance("longsword-basic", "other", [{ id: "flat-physical", value: 2 }]);
    const inventory = [body, accessory, other];
    let loadouts = equipGear(createEmptyGearLoadouts(), "knight", "body", body, inventory);
    loadouts = equipGear(loadouts, "knight", "left-accessory", accessory, inventory);
    loadouts = equipGear(loadouts, "rogue", "main-hand", other, inventory);
    loadouts.knight["right-accessory"] = "missing";
    expect(computeGearManifest("knight", inventory, loadouts)).toEqual({
      ...defaultGearEffects,
      flatPhysicalDamage: 2,
      maxHealth: 7,
    });
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

  it("clears off-hand when equipping a two-handed main-hand weapon", () => {
    const staff = makeGearInstance("staff-basic", "staff");
    const shield: GearInstance = {
      instanceId: "shield-1",
      definitionId: "leather-buckler-basic",
      affixes: [],
    };
    let loadouts = equipGear(createEmptyGearLoadouts(), "knight", "off-hand", shield, [staff, shield]);
    loadouts = equipGear(loadouts, "knight", "main-hand", staff, [staff, shield]);
    expect(loadouts.knight["main-hand"]).toBe(staff.instanceId);
    expect(loadouts.knight["off-hand"]).toBeNull();
  });

  it("clears two-handed main-hand when equipping off-hand", () => {
    const staff = makeGearInstance("staff-basic", "staff");
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

  it("rejects malformed persisted gear instances", () => {
    expect(normalizeGearInstance(null)).toBeNull();
    expect(normalizeGearInstance({})).toBeNull();
    expect(normalizeGearInstance({ instanceId: 1, definitionId: "ruby-ring-basic" })).toBeNull();
    expect(normalizeGearInstance({ instanceId: "gear-1", definitionId: "not-a-gear-id" })).toBeNull();
    for (const definitionId of ["constructor", "__proto__", "toString"]) {
      expect(normalizeGearInstance({ instanceId: "gear-1", definitionId })).toBeNull();
    }
  });

  it("does not apply the same saved affix twice", () => {
    const normalized = normalizeGearInstance({
      instanceId: "sword-1",
      definitionId: "shortsword-basic",
      affixes: [
        { id: "flat-physical", value: 1 },
        { id: "flat-physical", value: 2 },
      ],
    });

    expect(normalized?.affixes).toEqual([{ id: "flat-physical", value: 1 }]);
  });

  it("caps a saved Basic item's affixes at the Basic slot limit", () => {
    const normalized = normalizeGearInstance({
      instanceId: "sword-1",
      definitionId: "shortsword-basic",
      affixes: [
        { id: "flat-physical", value: 1 },
        { id: "flat-stun", value: 1 },
        { id: "flat-holy", value: 1 },
      ],
    });

    expect(normalized?.affixes).toEqual([
      { id: "flat-physical", value: 1 },
      { id: "flat-stun", value: 1 },
    ]);
  });

  it("drops a Unique signature from an ordinary saved item", () => {
    const normalized = normalizeGearInstance({
      instanceId: "sword-1",
      definitionId: "shortsword-basic",
      affixes: [{ id: "kingbreaker", value: 1 }],
    });

    expect(normalized?.affixes).toEqual([]);
  });

  it("salvages equipped gear for crafting currencies and clears loadouts", () => {
    const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "left-accessory", ring, [ring]);
    const result = salvageGear([ring], loadouts, ring.instanceId);
    expect(result?.inventory).toEqual([]);
    expect(result?.loadouts.knight["left-accessory"]).toBeNull();
    expect(result?.yieldedCurrencies).toEqual(computeSalvageYield(ring).currencies);
    expect(result?.yieldedMaterials).toEqual({ ...emptyInventory(), gems: 3 });
  });

  it("rejects salvaging nonexistent Gear", () => {
    expect(salvageGear([ring], createEmptyGearLoadouts(), "missing-ring")).toBeNull();
  });

  it("normalizes partial loadouts and exclusive references", () => {
    const partial = normalizeGearLoadout({ body: "body-1" });
    expect(partial.body).toBe("body-1");
    expect(partial).not.toHaveProperty("trinket-1");

    const exclusive = normalizeExclusiveGearLoadouts({
      ...createEmptyGearLoadouts(),
      knight: { ...createEmptyGearLoadouts().knight, "left-accessory": "ring-1" },
      rogue: { ...createEmptyGearLoadouts().rogue, "right-accessory": "ring-1" },
    });
    expect(exclusive.knight["left-accessory"]).toBe("ring-1");
    expect(exclusive.rogue["right-accessory"]).toBeNull();
  });

  it("prunes loadout references missing from inventory", () => {
    const inventory = [ring];
    const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "left-accessory", ring, [ring]);
    const pruned = pruneOrphanGearLoadouts([], loadouts);
    expect(pruned.knight["left-accessory"]).toBeNull();
    expect(pruneOrphanGearLoadouts(inventory, loadouts).knight["left-accessory"]).toBe("ring-1");
  });

  it("repairs a two-handed main-hand with an occupied off-hand on load", () => {
    const staff = makeGearInstance("staff-basic", "staff-1");
    const shield = makeGearInstance("leather-buckler-basic", "shield-1");
    const loadouts = {
      ...createEmptyGearLoadouts(),
      knight: { ...createEmptyGearLoadouts().knight, "main-hand": staff.instanceId, "off-hand": shield.instanceId },
    };
    const pruned = pruneOrphanGearLoadouts([staff, shield], loadouts);
    expect(pruned.knight["main-hand"]).toBe(staff.instanceId);
    expect(pruned.knight["off-hand"]).toBeNull();
  });

  it("repairs a ranged main-hand with a non-quiver off-hand on load", () => {
    const longbow = makeGearInstance("longbow-basic", "longbow-1");
    const buckler = makeGearInstance("leather-buckler-basic", "buckler-1");
    const loadouts = {
      ...createEmptyGearLoadouts(),
      knight: {
        ...createEmptyGearLoadouts().knight,
        "main-hand": longbow.instanceId,
        "off-hand": buckler.instanceId,
      },
    };
    const pruned = pruneOrphanGearLoadouts([longbow, buckler], loadouts);
    expect(pruned.knight["main-hand"]).toBe(longbow.instanceId);
    expect(pruned.knight["off-hand"]).toBeNull();
  });

  describe("ranged weapons and quivers", () => {
    it.each(["body", "left-accessory", "right-accessory"] as const)(
      "preserves a bow and quiver when equipping the %s slot",
      (slot) => {
        const bow: GearInstance = { instanceId: "bow", definitionId: "shortbow-basic", affixes: [] };
        const arrows: GearInstance = { instanceId: "arrows", definitionId: "quiver-basic", affixes: [] };
        const item: GearInstance = {
          instanceId: "other",
          definitionId: slot === "body" ? "leather-armor-basic" : "ruby-ring-basic",
          affixes: [],
        };
        const inventory = [bow, arrows, item];
        const armed = equipGear(createEmptyGearLoadouts(), "rogue", "main-hand", bow, inventory);
        const ready = equipGear(armed, "rogue", "off-hand", arrows, inventory);

        const result = equipGear(ready, "rogue", slot, item, inventory);

        expect(result.rogue[slot]).toBe(item.instanceId);
        expect(result.rogue["main-hand"]).toBe(bow.instanceId);
        expect(result.rogue["off-hand"]).toBe(arrows.instanceId);
        expect(ready.rogue["off-hand"]).toBe(arrows.instanceId);
      },
    );

    const longbow: GearInstance = { instanceId: "longbow-1", definitionId: "longbow-basic", affixes: [] };
    const longsword: GearInstance = { instanceId: "longsword-1", definitionId: "longsword-basic", affixes: [] };
    const quiver: GearInstance = { instanceId: "quiver-1", definitionId: "quiver-basic", affixes: [] };
    const buckler: GearInstance = { instanceId: "buckler-1", definitionId: "leather-buckler-basic", affixes: [] };

    it.each(["unequip", "salvage", "transfer", "restore"])(
      "removes an unsupported Quiver when its bow leaves through %s",
      (action) => {
        const inventory = [longbow, quiver];
        const withBow = equipGear(createEmptyGearLoadouts(), "knight", "main-hand", longbow, inventory);
        const equipped = equipGear(withBow, "knight", "off-hand", quiver, inventory);
        const result =
          action === "unequip"
            ? unequipGear(equipped, "knight", "main-hand", inventory)
            : action === "salvage"
              ? salvageGear(inventory, equipped, longbow.instanceId)!.loadouts
              : action === "transfer"
                ? equipGear(equipped, "ranger", "main-hand", longbow, inventory)
                : pruneOrphanGearLoadouts([quiver], equipped);
        expect(result.knight["main-hand"]).toBeNull();
        expect(result.knight["off-hand"]).toBeNull();
        expect(equipped.knight["off-hand"]).toBe(quiver.instanceId);
      },
    );

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

    it.each(["longsword-basic", "staff-basic"])(
      "rejects equipping %s while a Quiver is in off-hand",
      (definitionId) => {
        const loadouts: GearLoadouts = createEmptyGearLoadouts();
        loadouts.knight["off-hand"] = quiver.instanceId;
        const weapon = makeGearInstance(definitionId);
        const inventory = [quiver, weapon];
        expect(
          isGearCompatibleWithLoadoutSlot(gearDefinitions[definitionId], "main-hand", loadouts.knight, inventory),
        ).toBe(false);
        expect(equipGear(loadouts, "knight", "main-hand", weapon, inventory)).toBe(loadouts);
      },
    );

    it("displaces a shield when equipping a bow but rejects the reverse selection", () => {
      const inventory = [longbow, buckler, ring];
      const withRing = equipGear(createEmptyGearLoadouts(), "knight", "left-accessory", ring, inventory);
      const withShield = equipGear(withRing, "knight", "off-hand", buckler, inventory);
      expect(
        isGearCompatibleWithLoadoutSlot(
          gearDefinitions[longbow.definitionId],
          "main-hand",
          withShield.knight,
          inventory,
        ),
      ).toBe(true);
      const withBow = equipGear(withShield, "knight", "main-hand", longbow, inventory);
      expect(withBow.knight).toEqual({ ...withRing.knight, "main-hand": longbow.instanceId });
      expect(withShield.knight["off-hand"]).toBe(buckler.instanceId);
      expect(equipGear(withBow, "knight", "off-hand", buckler, inventory)).toBe(withBow);
    });

    it("allows a melee weapon after the player unequips their Quiver", () => {
      const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "main-hand", longbow, [longbow]);
      const withQuiver = equipGear(loadouts, "knight", "off-hand", quiver, [longbow, quiver]);
      expect(withQuiver.knight["off-hand"]).toBe(quiver.instanceId);
      const withQuiverRemoved = unequipGear(withQuiver, "knight", "off-hand", [longbow, quiver]);
      const swapped = equipGear(withQuiverRemoved, "knight", "main-hand", longsword, [longbow, quiver, longsword]);
      expect(swapped.knight["main-hand"]).toBe(longsword.instanceId);
      expect(swapped.knight["off-hand"]).toBeNull();
    });
  });

  describe("dual-wield one-handers", () => {
    const dualWieldDefinitionIds = [
      "hatchet-basic",
      "longsword-basic",
      "shortsword-basic",
      "dagger-basic",
      "mace-basic",
      "flail-basic",
      "wand-basic",
    ] as const;

    it("allows one-handed melee and wand in main-hand or off-hand", () => {
      for (const definitionId of dualWieldDefinitionIds) {
        const definition = gearDefinitions[definitionId];
        expect(isGearCompatibleWithSlot(definition, "main-hand"), definitionId).toBe(true);
        expect(isGearCompatibleWithSlot(definition, "off-hand"), definitionId).toBe(true);
      }
    });

    it("keeps two-handers and ranged weapons out of off-hand", () => {
      for (const definitionId of [
        "double-axe-basic",
        "maul-basic",
        "greatsword-basic",
        "staff-basic",
        "longbow-basic",
        "shortbow-basic",
        "recurve-bow-basic",
        "crossbow-basic",
      ] as const) {
        expect(isGearCompatibleWithSlot(gearDefinitions[definitionId], "off-hand"), definitionId).toBe(false);
      }
    });

    it("equips a one-hander in off-hand beside another one-handed main-hand", () => {
      const longsword: GearInstance = { instanceId: "sword-1", definitionId: "longsword-basic", affixes: [] };
      const dagger: GearInstance = { instanceId: "dagger-1", definitionId: "dagger-basic", affixes: [] };
      const inventory = [longsword, dagger];
      let loadouts = equipGear(createEmptyGearLoadouts(), "knight", "main-hand", longsword, inventory);
      loadouts = equipGear(loadouts, "knight", "off-hand", dagger, inventory);
      expect(loadouts.knight["main-hand"]).toBe(longsword.instanceId);
      expect(loadouts.knight["off-hand"]).toBe(dagger.instanceId);
    });

    it("rejects a one-hander in off-hand when main-hand is ranged", () => {
      const longbow: GearInstance = { instanceId: "bow-1", definitionId: "longbow-basic", affixes: [] };
      const dagger: GearInstance = { instanceId: "dagger-1", definitionId: "dagger-basic", affixes: [] };
      const inventory = [longbow, dagger];
      const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "main-hand", longbow, inventory);
      expect(
        isGearCompatibleWithLoadoutSlot(gearDefinitions["dagger-basic"], "off-hand", loadouts.knight, inventory),
      ).toBe(false);
      const result = equipGear(loadouts, "knight", "off-hand", dagger, inventory);
      expect(result.knight["off-hand"]).toBeNull();
    });
  });

  describe("salvage repair", () => {
    it("salvageGear cleans up loadouts with post-salvage inventory", () => {
      const longsword: GearInstance = { instanceId: "sword-1", definitionId: "longsword-basic", affixes: [] };
      const otherItem: GearInstance = { instanceId: "other-1", definitionId: "dagger-basic", affixes: [] };
      const inventory = [longsword, otherItem];
      const loadouts = createEmptyGearLoadouts();
      loadouts.knight["main-hand"] = longsword.instanceId;
      loadouts.knight["off-hand"] = "nonexistent-item";

      const result = salvageGear(inventory, loadouts, longsword.instanceId);
      expect(result).not.toBeNull();
      expect(result!.inventory).toEqual([otherItem]);
      expect(result!.loadouts.knight["main-hand"]).toBeNull();
      expect(result!.loadouts.knight["off-hand"]).toBeNull();
    });
  });
});
