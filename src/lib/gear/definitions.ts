import { placeholderGear } from "@/lib/game-data/assets";
import { gearArtByDefinitionId } from "@/lib/game-data/gear-art";
import { emptyInventory } from "@/lib/homestead/inventory";
import { gearBaseItems, type GearBaseItemId } from "./base-items";
import {
  defaultGearEffects,
  PLACEHOLDER_GEAR_DEFINITION_IDS,
  type GearDefinition,
  type GearRarity,
  type GearSlot,
  type PlaceholderGearDefinitionId,
} from "./types";

function formatVariantTitle(displayName: string, rarity: GearRarity): string {
  const label = rarity === "astral" ? "Astral" : "Basic";
  return `${label} ${displayName}`;
}

function placeholder(id: PlaceholderGearDefinitionId, title: string, compatibleSlots: GearSlot[]): GearDefinition {
  return {
    id,
    baseItemId: id,
    rarity: null,
    title,
    compatibleSlots,
    requiresTwoHands: false,
    affinityKeywords: ["physical"],
    descriptionLines: ["Increases Physical damage by 1."],
    art: placeholderGear,
    effects: { ...defaultGearEffects, flatPhysicalDamage: 1 },
    salvageValue: { ...emptyInventory(), iron: 1 },
  };
}

const placeholderDefinitions: Record<PlaceholderGearDefinitionId, GearDefinition> = {
  "placeholder-body": placeholder("placeholder-body", "Placeholder Body", ["body"]),
  "placeholder-helm": placeholder("placeholder-helm", "Placeholder Helm", ["helm"]),
  "placeholder-boots": placeholder("placeholder-boots", "Placeholder Boots", ["boots"]),
  "placeholder-gloves": placeholder("placeholder-gloves", "Placeholder Gloves", ["gloves"]),
  "placeholder-belt": placeholder("placeholder-belt", "Placeholder Belt", ["belt"]),
  "placeholder-main-hand": placeholder("placeholder-main-hand", "Placeholder Main Hand", ["main-hand"]),
  "placeholder-off-hand": placeholder("placeholder-off-hand", "Placeholder Off-Hand", ["off-hand"]),
  "placeholder-ring": placeholder("placeholder-ring", "Placeholder Ring", ["left-ring", "right-ring"]),
  "placeholder-amulet": placeholder("placeholder-amulet", "Placeholder Amulet", ["amulet"]),
};

function buildVariantDefinitions(): Record<string, GearDefinition> {
  const variants: Record<string, GearDefinition> = {};

  for (const baseItem of Object.values(gearBaseItems)) {
    for (const rarity of baseItem.availableRarities) {
      const id = `${baseItem.id}-${rarity}`;
      variants[id] = {
        id,
        baseItemId: baseItem.id as GearBaseItemId,
        rarity,
        title: formatVariantTitle(baseItem.displayName, rarity),
        compatibleSlots: [...baseItem.compatibleSlots],
        requiresTwoHands: baseItem.requiresTwoHands,
        affinityKeywords: [...baseItem.affinityKeywords],
        descriptionLines: [],
        art: gearArtByDefinitionId[id] ?? placeholderGear,
        effects: { ...defaultGearEffects },
        salvageValue: { ...baseItem.salvageByRarity[rarity] },
      };
    }
  }

  return variants;
}

export const gearDefinitions: Record<string, GearDefinition> = {
  ...placeholderDefinitions,
  ...buildVariantDefinitions(),
};

export type GearDefinitionId = string;

export const GEAR_DEFINITION_IDS = Object.keys(gearDefinitions) as [GearDefinitionId, ...GearDefinitionId[]];

export const gearDefinitionList = Object.values(gearDefinitions);

export const generatedGearDefinitionList = gearDefinitionList.filter(
  (definition) => !PLACEHOLDER_GEAR_DEFINITION_IDS.includes(definition.id as PlaceholderGearDefinitionId),
);

export function getGearDefinitionsByRarity(rarity: GearRarity): GearDefinition[] {
  return generatedGearDefinitionList.filter((definition) => definition.rarity === rarity);
}
