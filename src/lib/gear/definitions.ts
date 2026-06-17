import { gearArtByDefinitionId } from "@/lib/game-data/gear-art";
import { gearBaseItems, type GearBaseItemId } from "./base-items";
import { defaultGearEffects, type GearDefinition, type GearRarity } from "./types";

function formatVariantTitle(displayName: string): string {
  return displayName;
}

function buildVariantDefinitions(): Record<string, GearDefinition> {
  const variants: Record<string, GearDefinition> = {};

  for (const baseItem of Object.values(gearBaseItems)) {
    for (const rarity of baseItem.availableRarities) {
      const id = `${baseItem.id}-${rarity}`;
      const art = gearArtByDefinitionId[id];
      if (!art) {
        throw new Error(`Missing gear art for ${id}`);
      }
      variants[id] = {
        id,
        baseItemId: baseItem.id as GearBaseItemId,
        rarity,
        title: formatVariantTitle(baseItem.displayName),
        compatibleSlots: [...baseItem.compatibleSlots],
        requiresTwoHands: baseItem.requiresTwoHands,
        affinityKeywords: [...baseItem.affinityKeywords],
        descriptionLines: [],
        art,
        effects: { ...defaultGearEffects },
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

/** @deprecated Use `gearDefinitionList` — placeholder definitions were removed. */
export const generatedGearDefinitionList = gearDefinitionList;

export function getGearDefinitionsByRarity(rarity: GearRarity): GearDefinition[] {
  return gearDefinitionList.filter((definition) => definition.rarity === rarity);
}
