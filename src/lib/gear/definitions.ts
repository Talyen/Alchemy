import type { KeywordId } from "@/lib/game-data";
import type { MaterialInventory } from "@/lib/homestead/types";
import { gearArtByDefinitionId } from "@/lib/game-data";
import { gearBaseItems, type GearBaseItemId } from "./base-items";
import { GEAR_RARITIES, type GearRarity, type GearSlot } from "./types-core";
import type { GearAffixId } from "./affix-catalog";

export interface GearAffixRoll {
  id: GearAffixId;
  value: number;
}

export interface GearDefinition {
  id: string;
  baseItemId: GearBaseItemId;
  rarity: GearRarity | null;
  descriptionLines: string[];
  art: string;
  compatibleSlots: GearSlot[];
  requiresTwoHands: boolean;
  affinityKeywords: KeywordId[];
  salvageValue: MaterialInventory;
  rangedWeapon?: boolean;
  quiver?: boolean;
}

export interface GearInstance {
  instanceId: string;
  definitionId: string;
  affixes: GearAffixRoll[];
}

export function gearInstanceRarity(instance: GearInstance): GearRarity {
  return gearDefinitions[instance.definitionId]?.rarity ?? "basic";
}

/** Single owner of the `<baseItemId>-<rarity>` definition-id format. */
export function gearDefinitionId(baseItemId: string, rarity: GearRarity): string {
  return `${baseItemId}-${rarity}`;
}

function buildVariantDefinitions(): Record<string, GearDefinition> {
  const variants: Record<string, GearDefinition> = {};

  for (const baseItemId of Object.keys(gearBaseItems) as GearBaseItemId[]) {
    const baseItem = gearBaseItems[baseItemId];
    for (const rarity of GEAR_RARITIES) {
      const id = gearDefinitionId(baseItemId, rarity);
      const art = gearArtByDefinitionId[id];
      if (!art) {
        throw new Error(`Missing gear art for ${id}`);
      }
      variants[id] = {
        id,
        baseItemId,
        rarity,
        compatibleSlots: [...baseItem.compatibleSlots],
        requiresTwoHands: baseItem.requiresTwoHands,
        affinityKeywords: [...baseItem.affinityKeywords],
        descriptionLines: [],
        art,
        salvageValue: { ...baseItem.salvageByRarity[rarity] },
        ...(baseItem.rangedWeapon !== undefined ? { rangedWeapon: baseItem.rangedWeapon } : {}),
        ...(baseItem.quiver !== undefined ? { quiver: baseItem.quiver } : {}),
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
