import { gearArtByDefinitionId } from "@/lib/game-data";
import { gearBaseItems, type GearBaseItemId } from "./base-items";
import type { GearDefinition, GearInstance, GearRarity } from "./types";
export type { GearAffixRoll, GearDefinition, GearInstance } from "./types";
import { getUniqueItemDefinition, uniqueItemList } from "./unique-catalog";

export function gearInstanceRarity(instance: GearInstance): GearRarity | null {
  return gearDefinitions[instance.definitionId]?.rarity ?? null;
}

export function gearDefinitionId(baseItemId: string, rarity: GearRarity): string {
  return `${baseItemId}-${rarity}`;
}

// Base ids whose art is missing from the generated barrel. Their definitions
// are still built with fallback art so a content gap never silently shrinks
// loot or saves at runtime; content-audit and the definitions tests fail
// loudly instead (see validateGearDefinitions).
export const missingGearArtDefinitionIds: string[] = [];

function resolveGearArt(id: string, fallbackId?: string): string | undefined {
  return (
    gearArtByDefinitionId[id] ??
    (fallbackId ? gearArtByDefinitionId[fallbackId] : undefined) ??
    Object.values(gearArtByDefinitionId)[0]
  );
}

function trackMissingArt(id: string, context: string): void {
  console.warn(`Missing gear art for ${id} (${context}) - using fallback art`);
  missingGearArtDefinitionIds.push(id);
}

function buildVariantDefinitions(): Record<string, GearDefinition> {
  const variants: Record<string, GearDefinition> = {};

  for (const baseItemId of Object.keys(gearBaseItems) as GearBaseItemId[]) {
    const baseItem = gearBaseItems[baseItemId];
    for (const rarity of ["basic", "astral"] as const) {
      const id = gearDefinitionId(baseItemId, rarity);
      const art = resolveGearArt(id, gearDefinitionId(baseItemId, rarity === "basic" ? "astral" : "basic"));
      if (!art) {
        console.warn(`Missing gear art for ${id} - skipping definition`);
        missingGearArtDefinitionIds.push(id);
        continue;
      }
      if (art !== gearArtByDefinitionId[id]) trackMissingArt(id, `base ${baseItemId}`);
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
    const art = resolveGearArt(
      gearDefinitionId(unique.baseItemId, "astral"),
      gearDefinitionId(unique.baseItemId, "basic"),
    );
    if (!art) {
      console.warn(`Missing gear art for unique ${unique.id} (base ${unique.baseItemId}) - skipping`);
      missingGearArtDefinitionIds.push(unique.id);
      continue;
    }
    if (art !== gearArtByDefinitionId[gearDefinitionId(unique.baseItemId, "astral")]) {
      trackMissingArt(unique.id, `base ${unique.baseItemId}`);
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

function baseItemDisplayName(definition: GearDefinition): string {
  return gearBaseItems[definition.baseItemId].displayName;
}

function titleForDefinition(definition: GearDefinition): string {
  const uniqueDef = getUniqueItemDefinition(definition.id);
  if (uniqueDef) return uniqueDef.displayName;
  const name = baseItemDisplayName(definition);
  return definition.rarity === "astral" ? `Astral ${name}` : name;
}

export function getGearDefinitionTitle(definition: GearDefinition): string {
  return titleForDefinition(definition);
}

export function getGearInstanceTitle(instance: GearInstance): string {
  const definition = gearDefinitions[instance.definitionId];
  if (!definition) return "Gear";
  return getGearDefinitionTitle(definition);
}
