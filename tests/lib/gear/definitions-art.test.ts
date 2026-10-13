import { describe, expect, it } from "vitest";
import { gearBaseItems } from "@/lib/gear/base-items";
import { gearDefinitions, missingGearArtDefinitionIds } from "@/lib/gear/definitions";
import { uniqueItemList } from "@/lib/gear/unique-catalog";

describe("gear definitions and art", () => {
  it("builds the complete catalog with independent slots, affinities, and salvage payouts", () => {
    const expected = [
      ...Object.keys(gearBaseItems).flatMap((id) =>
        (["basic", "astral"] as const).map((rarity) => ({
          id: `${id}-${rarity}`,
          baseItemId: id,
          rarity,
        })),
      ),
      ...uniqueItemList.map((item) => ({ id: item.id, baseItemId: item.baseItemId, rarity: "unique" as const })),
    ];
    expect(Object.keys(gearDefinitions).sort()).toEqual(expected.map((item) => item.id).sort());
    for (const identity of expected) {
      const definition = gearDefinitions[identity.id]!;
      const base = gearBaseItems[definition.baseItemId];
      expect(definition, identity.id).toMatchObject({
        ...identity,
        compatibleSlots: base.compatibleSlots,
        slotRule: base.slotRule,
        affinityKeywords: base.affinityKeywords,
        salvageValue: base.salvageByRarity[identity.rarity],
      });
      expect(definition.compatibleSlots).not.toBe(base.compatibleSlots);
      expect(definition.affinityKeywords).not.toBe(base.affinityKeywords);
      expect(definition.salvageValue).not.toBe(base.salvageByRarity[identity.rarity]);
    }
  });
  it("resolves art for every definition without missing-art fallbacks", () => {
    expect(missingGearArtDefinitionIds).toEqual([]);
  });
});
