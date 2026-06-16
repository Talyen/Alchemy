import { describe, expect, it } from "vitest";
import { gearBaseItems } from "@/lib/gear/base-items";
import { gearDefinitions, generatedGearDefinitionList, GEAR_DEFINITION_IDS } from "@/lib/gear/definitions";
import { gearArtByDefinitionId } from "@/lib/game-data/gear-art";
import { PLACEHOLDER_GEAR_DEFINITION_IDS } from "@/lib/gear/types";

describe("gear definitions and art", () => {
  it("builds one variant per base item rarity", () => {
    for (const baseItem of Object.values(gearBaseItems)) {
      for (const rarity of baseItem.availableRarities) {
        const id = `${baseItem.id}-${rarity}`;
        expect(gearDefinitions[id]).toBeDefined();
        expect(gearDefinitions[id]?.rarity).toBe(rarity);
        expect(gearDefinitions[id]?.baseItemId).toBe(baseItem.id);
        expect(gearDefinitions[id]?.requiresTwoHands).toBe(baseItem.requiresTwoHands);
      }
    }
  });

  it("keeps definition ids aligned with the catalog", () => {
    expect(GEAR_DEFINITION_IDS.length).toBe(
      PLACEHOLDER_GEAR_DEFINITION_IDS.length + generatedGearDefinitionList.length,
    );
  });

  it("maps art for every generated gear variant", () => {
    for (const definition of generatedGearDefinitionList) {
      expect(gearArtByDefinitionId[definition.id], `${definition.id} missing art`).toBeTruthy();
    }
  });

  it("maps art only for known variant definitions", () => {
    for (const [definitionId, art] of Object.entries(gearArtByDefinitionId)) {
      expect(gearDefinitions[definitionId]).toBeDefined();
      expect(art).toBeTruthy();
      expect(definitionId).toMatch(/-(basic|astral)$/);
    }
  });
});
