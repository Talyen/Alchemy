import { gearArtByDefinitionId } from "@/lib/game-data/gear-art";
import { gearBaseItems, type GearBaseItemId } from "./base-items";
import type { GearDefinition, GearInstance, GearRarity } from "./types";

export function gearInstanceRarity(instance: GearInstance): GearRarity {
  return gearDefinitions[instance.definitionId]?.rarity ?? "basic";
}

function buildVariantDefinitions(): Record<string, GearDefinition> {
  const variants: Record<string, GearDefinition> = {};

  for (const baseItemId of Object.keys(gearBaseItems) as GearBaseItemId[]) {
    const baseItem = gearBaseItems[baseItemId];
    for (const rarity of baseItem.availableRarities) {
      const id = `${baseItemId}-${rarity}`;
      const art = gearArtByDefinitionId[id];
      if (!art) {
        throw new Error(`Missing gear art for ${id}`);
      }
      variants[id] = {
        id,
        baseItemId,
        rarity,
        title: baseItem.displayName,
        compatibleSlots: [...baseItem.compatibleSlots],
        requiresTwoHands: baseItem.requiresTwoHands,
        affinityKeywords: [...baseItem.affinityKeywords],
        descriptionLines: [],
        art,
        salvageValue: { ...baseItem.salvageByRarity[rarity] },
      };
    }
  }

  return variants;
}

export const gearDefinitions: Record<string, GearDefinition> = buildVariantDefinitions();

export type GearDefinitionId = keyof typeof gearDefinitions;

export const GEAR_DEFINITION_IDS = Object.keys(gearDefinitions) as [GearDefinitionId, ...GearDefinitionId[]];

export const gearDefinitionList = Object.values(gearDefinitions);

export function getGearDefinitionsByRarity(rarity: GearRarity): GearDefinition[] {
  return gearDefinitionList.filter((definition) => definition.rarity === rarity);
}
