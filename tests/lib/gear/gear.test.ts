import { describe, expect, it } from "vitest";
import { gearAffixCatalog } from "@/lib/gear/affix-catalog";
import {
  canSalvageGear,
  computeGearManifest,
  computeGearMaxHealthBonus,
  createEmptyGearLoadouts,
  createGearInstance,
  defaultGearEffects,
  effectsForInstance,
  equipGear,
  formatSalvageValue,
  gearDefinitions,
  isGearCompatibleWithSlot,
  isTwoHanded,
  modifiersToAffixRolls,
  normalizeExclusiveGearLoadouts,
  normalizeGearInstance,
  normalizeGearLoadout,
  pruneOrphanGearLoadouts,
  resolveAffixEffects,
  rollAffixCount,
  rollAffixes,
  rollGearRewardRarity,
  salvageGear,
  unequipGear,
  type GearInstance,
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
      equipGear(loadouts, "knight", "body", {
        instanceId: "x",
        definitionId: "not-a-gear-id",
        affixes: [],
      }, []),
    ).toBe(loadouts);

    expect(
      equipGear(loadouts, "knight", "helm", {
        instanceId: "body-1",
        definitionId: "leather-armor-basic",
        affixes: [],
      }, []),
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
    expect(modifiersToAffixRolls([{ kind: "flatPhysicalDamage", value: 2 }])).toEqual([
      { id: "flat-physical", value: 1 },
      { id: "flat-physical", value: 1 },
    ]);
    expect(resolveAffixEffects(modifiersToAffixRolls([{ kind: "flatPhysicalDamage", value: 2 }]), "basic")).toEqual(
      manifestWithPhysical(2),
    );
  });

  it("rolls basic and astral affix counts in range", () => {
    expect(rollAffixCount("basic", () => 0)).toBe(1);
    expect(rollAffixCount("basic", () => 0.99)).toBe(2);
    expect(rollAffixCount("astral", () => 0)).toBe(3);
    expect(rollAffixCount("astral", () => 0.99)).toBe(4);
  });

  it("rolls affixes only from the eligible hard-filter pool", () => {
    const definition = gearDefinitions["ruby-ring-basic"];
    const rolls = Array.from({ length: 20 }, (_, index) => index / 20);
    for (const roll of rolls) {
      const selected = rollAffixes(definition, 1, () => roll);
      for (const affixRoll of selected) {
        const affixDef = gearAffixCatalog[affixRoll.id];
        expect(
          definition.affinityKeywords.includes(affixDef.keywordId) ||
            (affixDef.secondaryKeywordId !== undefined &&
              definition.affinityKeywords.includes(affixDef.secondaryKeywordId)),
        ).toBe(true);
      }
    }
  });

  it("rolls reward gear rarity 50/50 with deterministic rng", () => {
    expect(rollGearRewardRarity(() => 0.1)).toBe("basic");
    expect(rollGearRewardRarity(() => 0.9)).toBe("astral");
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

  it("reports gear max-health bonus from equipped loadout", () => {
    const body: GearInstance = {
      instanceId: "body-1",
      definitionId: "leather-armor-basic",
      affixes: [{ id: "max-health", value: 2 }],
    };
    const loadouts = equipGear(createEmptyGearLoadouts(), "knight", "body", body, [body]);
    expect(computeGearMaxHealthBonus("knight", [body], loadouts)).toBeGreaterThan(0);
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
});
