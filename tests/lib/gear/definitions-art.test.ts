import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { gearArtByDefinitionId } from "@/lib/game-data/gear-art.generated";
import { gearBaseItems } from "@/lib/gear/base-items";
import { gearDefinitions, gearDefinitionList, missingGearArtDefinitionIds } from "@/lib/gear/definitions";
import { uniqueItemList } from "@/lib/gear/unique-catalog";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const optimizedDir = path.join(rootDir, "src", "assets", "optimized");

function isGearSlotArtKey(definitionId: string): boolean {
  return definitionId.startsWith("slot-");
}

function isGearVariantArtKey(definitionId: string): boolean {
  return /-(basic|astral)$/.test(definitionId) && !isGearSlotArtKey(definitionId);
}

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

  it("has no unused item art mappings", () => {
    const mappedVariantIds = Object.keys(gearArtByDefinitionId).filter(isGearVariantArtKey);
    const definedVariantIds = gearDefinitionList
      .filter((definition) => definition.rarity !== "unique")
      .map((definition) => definition.id);

    expect(mappedVariantIds.sort()).toEqual(definedVariantIds.sort());
  });

  it("matches optimized gear item webp files to art mappings", async () => {
    let entries: string[];
    try {
      entries = await readdir(optimizedDir);
    } catch {
      entries = [];
    }

    const itemWebps = entries.filter((name) => name.startsWith("gear-") && !name.startsWith("gear-slot-"));
    const mappedWebps = new Set(
      Object.keys(gearArtByDefinitionId)
        .filter(isGearVariantArtKey)
        .map((definitionId) => `gear-${definitionId}.webp`),
    );

    const unmappedFiles = itemWebps.filter((name) => !mappedWebps.has(name));
    const missingFiles = [...mappedWebps].filter((name) => !itemWebps.includes(name));

    expect(unmappedFiles, `unused optimized gear art: ${unmappedFiles.join(", ")}`).toEqual([]);
    expect(missingFiles, `missing optimized gear art: ${missingFiles.join(", ")}`).toEqual([]);
  });
});
