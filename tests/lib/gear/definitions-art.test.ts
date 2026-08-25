import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { gearArtByDefinitionId } from "@/lib/game-data/gear-art";
import { gearBaseItems } from "@/lib/gear/base-items";
import { gearDefinitions, gearDefinitionList, GEAR_DEFINITION_IDS } from "@/lib/gear/definitions";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const optimizedDir = path.join(rootDir, "src", "assets", "optimized");

function isGearSlotArtKey(definitionId: string): boolean {
  return definitionId.startsWith("slot-");
}

function isGearVariantArtKey(definitionId: string): boolean {
  return /-(basic|astral)$/.test(definitionId) && !isGearSlotArtKey(definitionId);
}

describe("gear definitions and art", () => {
  it("builds one variant per base item rarity", () => {
    for (const baseItem of Object.values(gearBaseItems)) {
      for (const rarity of ["basic", "astral"] as const) {
        const id = `${baseItem.id}-${rarity}`;
        expect(gearDefinitions[id]).toBeDefined();
        expect(gearDefinitions[id]?.rarity).toBe(rarity);
        expect(gearDefinitions[id]?.baseItemId).toBe(baseItem.id);
        expect(gearDefinitions[id]?.requiresTwoHands).toBe(baseItem.requiresTwoHands);
      }
    }
  });

  it("keeps definition ids aligned with the catalog", () => {
    expect(GEAR_DEFINITION_IDS.length).toBe(gearDefinitionList.length);
  });

  it("maps art for every gear variant", () => {
    for (const definition of gearDefinitionList) {
      if (definition.rarity !== "unique") {
        expect(gearArtByDefinitionId[definition.id], `${definition.id} missing art`).toBeTruthy();
      }
      expect(definition.art, `${definition.id} missing resolved art`).toBeTruthy();
    }
  });

  it("maps item art only for known gear variant definitions", () => {
    for (const [definitionId, art] of Object.entries(gearArtByDefinitionId)) {
      if (!isGearVariantArtKey(definitionId)) continue;
      expect(gearDefinitions[definitionId], `${definitionId} has art but no definition`).toBeDefined();
      expect(art).toBeTruthy();
    }
  });

  it("maps slot background art under slot-* keys only", () => {
    for (const [definitionId, art] of Object.entries(gearArtByDefinitionId)) {
      if (!isGearSlotArtKey(definitionId)) continue;
      expect(art).toBeTruthy();
      expect(gearDefinitions[definitionId], `${definitionId} should not be a gear definition`).toBeUndefined();
    }
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
