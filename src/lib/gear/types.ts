import { characters, type CharacterId, type KeywordId } from "@/lib/game-data";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { GearAffixId } from "./affix-ids";
import type { GearBaseItemId } from "./base-items";
import type { GearDefinitionId } from "./definitions";

export type GearCharacterId = CharacterId;

export const GEAR_SLOTS = [
  "body",
  "helm",
  "boots",
  "gloves",
  "belt",
  "main-hand",
  "off-hand",
  "left-ring",
  "right-ring",
  "amulet",
] as const;

export const GEAR_CHARACTER_IDS = Object.keys(characters) as GearCharacterId[];

export const PLACEHOLDER_GEAR_DEFINITION_IDS = [
  "placeholder-body",
  "placeholder-helm",
  "placeholder-boots",
  "placeholder-gloves",
  "placeholder-belt",
  "placeholder-main-hand",
  "placeholder-off-hand",
  "placeholder-ring",
  "placeholder-amulet",
] as const;

export type GearSlot = (typeof GEAR_SLOTS)[number];
export type GearRarity = "basic" | "astral";
export type PlaceholderGearDefinitionId = (typeof PLACEHOLDER_GEAR_DEFINITION_IDS)[number];

export type { GearAffixId } from "./affix-ids";
export type { GearBaseItemId } from "./base-items";
export type { GearDefinitionId } from "./definitions";

/** @deprecated Legacy save field — normalized to affixIds on load. */
export type GearModifier = { kind: "flatPhysicalDamage"; value: number };

export type GearEffectManifest = {
  flatPhysicalDamage: number;
  flatStunDamage: number;
  flatHolyDamage: number;
  flatBurnDamage: number;
  flatPoisonDamage: number;
  flatBleedDamage: number;
  flatFreezeDamage: number;
  flatNatureDamage: number;
};

export const defaultGearEffects: GearEffectManifest = {
  flatPhysicalDamage: 0,
  flatStunDamage: 0,
  flatHolyDamage: 0,
  flatBurnDamage: 0,
  flatPoisonDamage: 0,
  flatBleedDamage: 0,
  flatFreezeDamage: 0,
  flatNatureDamage: 0,
};

export type GearDefinition = {
  id: string;
  baseItemId: GearBaseItemId | `placeholder-${string}`;
  rarity: GearRarity | null;
  title: string;
  descriptionLines: string[];
  art: string;
  compatibleSlots: GearSlot[];
  requiresTwoHands: boolean;
  affinityKeywords: KeywordId[];
  effects: GearEffectManifest;
  salvageValue: MaterialInventory;
};

export type GearInstance = {
  instanceId: string;
  definitionId: GearDefinitionId;
  affixIds: GearAffixId[];
};

export type GearInventory = GearInstance[];
export type GearLoadout = Record<GearSlot, string | null>;
export type GearLoadouts = Record<GearCharacterId, GearLoadout>;

export type GearBoardPosition = { col: number; row: number };
export type GearBoardPositions = Record<string, GearBoardPosition>;

export function pruneGearBoardPositions(
  boardPositions: GearBoardPositions,
  inventory: GearInstance[],
): GearBoardPositions {
  const inventoryIds = new Set(inventory.map((item) => item.instanceId));
  const next: GearBoardPositions = {};
  for (const [instanceId, position] of Object.entries(boardPositions)) {
    if (inventoryIds.has(instanceId)) next[instanceId] = position;
  }
  return next;
}

export function createEmptyGearLoadout(): GearLoadout {
  return Object.fromEntries(GEAR_SLOTS.map((slot) => [slot, null])) as GearLoadout;
}

export function createEmptyGearLoadouts(): GearLoadouts {
  return Object.fromEntries(GEAR_CHARACTER_IDS.map((id) => [id, createEmptyGearLoadout()])) as GearLoadouts;
}

export function normalizeGearLoadout(loadout: Partial<GearLoadout> | null | undefined): GearLoadout {
  const next = createEmptyGearLoadout();
  if (!loadout) return next;
  for (const slot of GEAR_SLOTS) {
    const value = loadout[slot];
    if (value !== undefined) next[slot] = value;
  }
  return next;
}

export function normalizeExclusiveGearLoadouts(loadouts: GearLoadouts): GearLoadouts {
  const seen = new Set<string>();
  const next = createEmptyGearLoadouts();

  for (const characterId of GEAR_CHARACTER_IDS) {
    for (const slot of GEAR_SLOTS) {
      const instanceId = loadouts[characterId][slot];
      if (!instanceId || seen.has(instanceId)) continue;
      seen.add(instanceId);
      next[characterId][slot] = instanceId;
    }
  }

  return next;
}

export function pruneOrphanGearLoadouts(inventory: GearInventory, loadouts: GearLoadouts): GearLoadouts {
  const inventoryIds = new Set(inventory.map((item) => item.instanceId));
  const next = createEmptyGearLoadouts();

  for (const characterId of GEAR_CHARACTER_IDS) {
    for (const slot of GEAR_SLOTS) {
      const instanceId = loadouts[characterId][slot];
      next[characterId][slot] = instanceId && inventoryIds.has(instanceId) ? instanceId : null;
    }
  }

  return next;
}
