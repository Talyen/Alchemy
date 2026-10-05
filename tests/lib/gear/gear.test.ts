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
  normalizeExclusiveGearLoadouts,
  normalizeGearInstance,
  pruneOrphanGearLoadouts,
  salvageGear,
  unequipGear,
  type GearInstance,
} from "@/lib/gear";
import { emptyInventory } from "@/lib/homestead/inventory";
import { makeGearInstance } from "../../helpers/gear-fixtures";

const ring: GearInstance = { instanceId: "ring-1", definitionId: "ruby-ring-basic", affixes: [] };

describe("gear domain", () => {
  it("moves one ring between slots and heroes without duplicating it or mutating earlier loadouts", () => {
    const left = equipGear(createEmptyGearLoadouts(), "knight", "left-accessory", ring, [ring]);
    const right = equipGear(left, "knight", "right-accessory", ring, [ring]);
    const rogue = equipGear(right, "rogue", "right-accessory", ring, [ring]);
    expect(left.knight["left-accessory"]).toBe(ring.instanceId);
    expect(right.knight).toEqual({ ...createEmptyGearLoadouts().knight, "right-accessory": ring.instanceId });
    expect(rogue.knight).toEqual(createEmptyGearLoadouts().knight);
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

  it("preserves the selected hand when switching between a staff and shield", () => {
    const staff = makeGearInstance("staff-basic", "staff");
    const shield = makeGearInstance("leather-buckler-basic", "shield");
    const inventory = [staff, shield];
    const armed = equipGear(createEmptyGearLoadouts(), "knight", "off-hand", shield, inventory);
    const withStaff = equipGear(armed, "knight", "main-hand", staff, inventory);
    expect(withStaff.knight).toEqual({ ...createEmptyGearLoadouts().knight, "main-hand": staff.instanceId });
    const withShield = equipGear(withStaff, "knight", "off-hand", shield, inventory);
    expect(withShield.knight).toEqual(armed.knight);
    expect(withStaff.knight["main-hand"]).toBe(staff.instanceId);
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

  it("repairs saved affixes before applying slot limits so invalid rolls cannot displace real bonuses", () => {
    const normalized = normalizeGearInstance({
      instanceId: "sword-1",
      definitionId: "shortsword-basic",
      affixes: [
        { id: "kingbreaker", value: 1 },
        { id: "flat-physical", value: 1 },
        { id: "flat-physical", value: 2 },
        { id: "flat-stun", value: 1 },
        { id: "flat-holy", value: 1 },
      ],
    });
    expect(normalized?.affixes).toEqual([
      { id: "flat-physical", value: 1 },
      { id: "flat-stun", value: 1 },
    ]);
    expect(effectsForInstance(normalized!).flatPhysicalDamage).toBe(1);
  });

  it("salvages equipped gear once, retains other inventory, and repairs orphan loadout references", () => {
    const other = makeGearInstance("dagger-basic", "other");
    const inventory = [ring, other];
    const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "left-accessory", ring, inventory);
    loadouts.knight["off-hand"] = "missing";
    const before = structuredClone(loadouts);
    const result = salvageGear(inventory, loadouts, ring.instanceId)!;
    expect(result.inventory).toEqual([other]);
    expect(result.loadouts.knight).toEqual(createEmptyGearLoadouts().knight);
    expect(result.yieldedCurrencies).toEqual(computeSalvageYield(ring).currencies);
    expect(result.yieldedMaterials).toEqual({ ...emptyInventory(), gems: 3 });
    expect(salvageGear(result.inventory, result.loadouts, ring.instanceId)).toBeNull();
    expect(loadouts).toEqual(before);
    expect(inventory).toEqual([ring, other]);
  });

  it("repairs duplicate and missing saved references deterministically", () => {
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight["left-accessory"] = ring.instanceId;
    loadouts.rogue["right-accessory"] = ring.instanceId;
    loadouts.knight.body = "missing";
    const exclusive = normalizeExclusiveGearLoadouts(loadouts);
    expect(exclusive.knight["left-accessory"]).toBe(ring.instanceId);
    expect(exclusive.rogue["right-accessory"]).toBeNull();
    expect(pruneOrphanGearLoadouts([ring], loadouts)).toEqual({
      ...createEmptyGearLoadouts(),
      knight: { ...createEmptyGearLoadouts().knight, "left-accessory": ring.instanceId },
    });
    expect(pruneOrphanGearLoadouts([], loadouts)).toEqual(createEmptyGearLoadouts());
    expect(loadouts.rogue["right-accessory"]).toBe(ring.instanceId);
  });

  it.each(["staff-basic", "longbow-basic"])("repairs an incompatible saved shield beside %s", (definitionId) => {
    const weapon = makeGearInstance(definitionId, "weapon");
    const shield = makeGearInstance("leather-buckler-basic", "shield");
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight["main-hand"] = weapon.instanceId;
    loadouts.knight["off-hand"] = shield.instanceId;
    expect(pruneOrphanGearLoadouts([weapon, shield], loadouts).knight).toEqual({
      ...createEmptyGearLoadouts().knight,
      "main-hand": weapon.instanceId,
    });
    expect(loadouts.knight["off-hand"]).toBe(shield.instanceId);
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

    it.each(["longsword-basic", "staff-basic"])(
      "rejects equipping %s while a Quiver is in off-hand",
      (definitionId) => {
        const loadouts = createEmptyGearLoadouts();
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

  it("equips two one-handed weapons but rejects an off-hand weapon beside a bow", () => {
    const sword = makeGearInstance("longsword-basic", "sword");
    const dagger = makeGearInstance("dagger-basic", "dagger");
    const bow = makeGearInstance("longbow-basic", "bow");
    const inventory = [sword, dagger, bow];
    const armed = equipGear(createEmptyGearLoadouts(), "knight", "main-hand", sword, inventory);
    const dual = equipGear(armed, "knight", "off-hand", dagger, inventory);
    expect(dual.knight).toEqual({ ...armed.knight, "off-hand": dagger.instanceId });
    const ranged = equipGear(dual, "knight", "main-hand", bow, inventory);
    expect(ranged.knight).toEqual({ ...armed.knight, "main-hand": bow.instanceId });
    expect(
      isGearCompatibleWithLoadoutSlot(gearDefinitions[dagger.definitionId], "off-hand", ranged.knight, inventory),
    ).toBe(false);
    expect(equipGear(ranged, "knight", "off-hand", dagger, inventory)).toBe(ranged);
    expect(dual.knight["off-hand"]).toBe(dagger.instanceId);
  });
});
