import { gearArtByDefinitionId } from "@/lib/game-data";
import { gearBaseItems, type GearBaseItemId } from "./base-items";
import type { GearDefinition, GearInstance, GearRarity } from "./types";
export type { GearAffixRoll, GearDefinition, GearInstance } from "./types";
import { uniqueItemList } from "./unique-catalog";

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

function createDefinition(
  baseItemId: GearBaseItemId,
  rarity: GearRarity,
  presentation: Pick<GearDefinition, "id" | "displayName" | "art" | "descriptionLines">,
): GearDefinition {
  const base = gearBaseItems[baseItemId];
  return {
    ...presentation,
    baseItemId,
    rarity,
    compatibleSlots: [...base.compatibleSlots],
    slotRule: base.slotRule,
    affinityKeywords: [...base.affinityKeywords],
    salvageValue: { ...base.salvageByRarity[rarity] },
  };
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
      variants[id] = createDefinition(baseItemId, rarity, {
        id,
        displayName: rarity === "astral" ? `Astral ${baseItem.displayName}` : baseItem.displayName,
        art,
        descriptionLines: [],
      });
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
    variants[unique.id] = createDefinition(unique.baseItemId, "unique", {
      id: unique.id,
      displayName: unique.displayName,
      art,
      descriptionLines: [unique.description],
    });
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

export function getGearDefinitionTitle(definition: GearDefinition): string {
  return definition.displayName;
}

export function getGearInstanceTitle(instance: GearInstance): string {
  return gearDefinitions[instance.definitionId]?.displayName ?? "Gear";
}
