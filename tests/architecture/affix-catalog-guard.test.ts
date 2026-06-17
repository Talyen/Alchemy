import { describe, expect, it } from "vitest";
import { GEAR_AFFIX_IDS } from "@/lib/gear/affix-ids";
import { gearAffixCatalog } from "@/lib/gear/affix-catalog";
import { gearAffixNameParts } from "@/lib/gear/affix-name-parts";
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

  it("tags every affix with offensive or defensive aspect", () => {
    for (const definition of Object.values(gearAffixCatalog)) {
      expect(["offensive", "defensive"]).toContain(definition.aspect);
    }
  });

  it("defines name parts for every affix with at least a prefix or suffix", () => {
    for (const id of GEAR_AFFIX_IDS) {
      const parts = gearAffixNameParts[id];
      expect(parts, `missing name parts for ${id}`).toBeDefined();
      expect(
        Boolean(parts.prefix || parts.suffix),
        `affix ${id} needs a prefix or suffix for item naming`,
      ).toBe(true);
    }
  });
});
