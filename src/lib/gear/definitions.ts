import type { KeywordId } from "@/lib/game-data";
import type { MaterialInventory } from "@/lib/homestead/types";
import { gearArtByDefinitionId } from "@/lib/game-data";
import { gearBaseItems, type GearBaseItemId, type GearSlotRule } from "./base-items";
import type { GearRarity, GearSlot } from "./types";
import type { GearAffixId } from "./affix-catalog";
import { uniqueItemList } from "./unique-catalog";

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
  slotRule: GearSlotRule;
  affinityKeywords: KeywordId[];
  salvageValue: MaterialInventory;
}

export interface GearInstance {
  instanceId: string;
  definitionId: string;
  affixes: GearAffixRoll[];
}

export function gearInstanceRarity(instance: GearInstance): GearRarity | null {
  return gearDefinitions[instance.definitionId]?.rarity ?? null;
}

export function gearDefinitionId(baseItemId: string, rarity: GearRarity): string {
  return `${baseItemId}-${rarity}`;
}

function buildVariantDefinitions(): Record<string, GearDefinition> {
  const variants: Record<string, GearDefinition> = {};

  for (const baseItemId of Object.keys(gearBaseItems) as GearBaseItemId[]) {
    const baseItem = gearBaseItems[baseItemId];
    for (const rarity of ["basic", "astral"] as const) {
      const id = gearDefinitionId(baseItemId, rarity);
      const art = gearArtByDefinitionId[id];
      if (!art) {
        console.warn(`Missing gear art for ${id} - using placeholder`);
        continue;
      }
      variants[id] = {
        id,
        baseItemId,
        rarity,
        compatibleSlots: [...baseItem.compatibleSlots],
        slotRule: baseItem.slotRule,
        affinityKeywords: [...baseItem.affinityKeywords],
        descriptionLines: [],
        art,
        salvageValue: { ...baseItem.salvageByRarity[rarity] },
      };
    }
  }

  for (const unique of uniqueItemList) {
    const baseItem = gearBaseItems[unique.baseItemId];
    if (!baseItem) continue;
    const art =
      gearArtByDefinitionId[gearDefinitionId(unique.baseItemId, "astral")] ??
      gearArtByDefinitionId[gearDefinitionId(unique.baseItemId, "basic")];
    if (!art) {
      console.warn(`Missing gear art for unique ${unique.id} (base ${unique.baseItemId}) - skipping`);
      continue;
    }
    variants[unique.id] = {
      id: unique.id,
      baseItemId: unique.baseItemId,
      rarity: "unique",
      compatibleSlots: [...baseItem.compatibleSlots],
      slotRule: baseItem.slotRule,
      affinityKeywords: [...baseItem.affinityKeywords],
      descriptionLines: [unique.description],
      art,
      salvageValue: { ...baseItem.salvageByRarity.unique },
    };
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
