import { describe, expect, it } from "vitest";
import { gearAffixCatalog } from "@/lib/gear/affix-catalog";
import { GEAR_EFFECT_KEYS } from "@/lib/gear/gear-effect-manifest";

const EFFECT_KEY_SET = new Set<string>(GEAR_EFFECT_KEYS);

describe("gear affix effect-key guard", () => {
  it("every affix in the catalog references an effectKey that exists in GEAR_EFFECT_KEYS", () => {
    const failures: string[] = [];

    for (const [affixId, definition] of Object.entries(gearAffixCatalog)) {
      if (!EFFECT_KEY_SET.has(definition.effectKey)) {
        failures.push(`${affixId} -> ${definition.effectKey}`);
      }
    }

    expect(failures).toEqual([]);
  });

  it("every effectKey in GEAR_EFFECT_KEYS is referenced by at least one affix", () => {
    const used = new Set<string>();
    for (const definition of Object.values(gearAffixCatalog)) {
      used.add(definition.effectKey);
    }
    const unused = [...EFFECT_KEY_SET].filter((key) => !used.has(key));
    expect(unused).toEqual([]);
  });

  it("GEAR_EFFECT_KEYS is non-empty and has unique entries", () => {
    expect(GEAR_EFFECT_KEYS.length).toBeGreaterThan(0);
    expect(new Set(GEAR_EFFECT_KEYS).size).toBe(GEAR_EFFECT_KEYS.length);
  });
});
