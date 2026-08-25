import { describe, expect, it } from "vitest";
import { GEAR_AFFIX_IDS, gearAffixCatalog } from "@/lib/gear/affix-catalog";
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
});
