import { describe, expect, it } from "vitest";
import { GEAR_AFFIX_COUNT } from "@/lib/game-constants";
import { GEAR_AFFIX_IDS, gearAffixCatalog } from "@/lib/gear/affix-catalog";
import { type GearBaseItemDefinition, gearBaseItemList } from "@/lib/gear/base-items";
import { gearDefinitions } from "@/lib/gear/definitions";
import { buildEligibleAffixPool } from "@/lib/gear/generation";
import { GEAR_EFFECT_KEYS } from "@/lib/gear/gear-effect-manifest";

describe("affix catalog guard", () => {
  it("defines every GEAR_AFFIX_IDS entry in gearAffixCatalog", () => {
    for (const id of GEAR_AFFIX_IDS) {
      expect(gearAffixCatalog[id], `missing catalog entry for ${id}`).toBeDefined();
    }
  });

  it("binds affix catalog keys to GEAR_EFFECT_KEYS", () => {
    const effectKeys = new Set<string>(GEAR_EFFECT_KEYS);
    for (const definition of Object.values(gearAffixCatalog)) {
      expect(effectKeys.has(definition.effectKey), `unknown effect key ${definition.effectKey}`).toBe(true);
    }
  });

  it("every effectKey in GEAR_EFFECT_KEYS is referenced by at least one affix", () => {
    const used = new Set<string>();
    for (const definition of Object.values(gearAffixCatalog)) {
      used.add(definition.effectKey);
    }
    const unused = [...new Set<string>(GEAR_EFFECT_KEYS)].filter((key) => !used.has(key));
    expect(unused).toEqual([]);
  });

  it("GEAR_EFFECT_KEYS is non-empty and has unique entries", () => {
    expect(GEAR_EFFECT_KEYS.length).toBeGreaterThan(0);
    expect(new Set(GEAR_EFFECT_KEYS).size).toBe(GEAR_EFFECT_KEYS.length);
  });

  it("tags every affix with offensive or defensive aspect", () => {
    for (const definition of Object.values(gearAffixCatalog)) {
      expect(["offensive", "defensive"]).toContain(definition.aspect);
    }
  });

  it("defines a non-empty name for every affix", () => {
    for (const id of GEAR_AFFIX_IDS) {
      const definition = gearAffixCatalog[id];
      expect(definition.name, `missing name for ${id}`).toBeDefined();
      expect(definition.name.length, `affix ${id} needs a non-empty name`).toBeGreaterThan(0);
    }
  });

  it("requires unique display names for affixes", () => {
    const seen = new Map<string, string>();
    for (const definition of Object.values(gearAffixCatalog)) {
      const prev = seen.get(definition.name);
      expect(prev, `duplicate affix name "${definition.name}" used by ${prev} and ${definition.id}`).toBeUndefined();
      seen.set(definition.name, definition.id);
    }
  });

  it("requires unique-only affixes to have fixed rolls at every rarity", () => {
    for (const definition of Object.values(gearAffixCatalog)) {
      if (!definition.uniqueOnly) continue;
      for (const range of Object.values(definition.roll)) {
        expect(range.min, `${definition.id} uniqueOnly should have fixed roll`).toBe(range.max);
      }
    }
  });
});

describe("gear affix pool guard", () => {
  it("every gear definition has an eligible pool at least as large as its minimum affix count", () => {
    const failures: string[] = [];

    for (const definition of Object.values(gearDefinitions)) {
      if (definition.rarity === null) continue;
      const pool = buildEligibleAffixPool(definition);
      const minCount = GEAR_AFFIX_COUNT[definition.rarity].min;
      if (pool.length < minCount) {
        failures.push(`${definition.id}: pool ${pool.length} < min ${minCount}`);
      }
    }

    expect(failures).toEqual([]);
  });
});

describe("ranged weapon tagging", () => {
  const list = gearBaseItemList as GearBaseItemDefinition[];

  it("every base item has an explicit slotRule", () => {
    const untagged = list.filter((item) => item.slotRule === undefined);
    expect(untagged, untagged.map((i) => i.id).join(", ")).toEqual([]);
  });

  it("only known ranged weapons have slotRule 'ranged'", () => {
    const ranged = list.filter((item) => item.slotRule === "ranged");
    const ids = ranged.map((item) => item.id).sort();
    expect(ids).toEqual(["crossbow", "longbow", "recurve-bow", "shortbow"]);
  });

  it("quiver has slotRule 'quiver'", () => {
    const quiver = list.find((item) => item.id === "quiver");
    expect(quiver?.slotRule).toBe("quiver");
  });

  it("no item other than quiver has slotRule 'quiver'", () => {
    const quivers = list.filter((item) => item.slotRule === "quiver");
    expect(quivers).toHaveLength(1);
    expect(quivers[0]!.id).toBe("quiver");
  });
});
