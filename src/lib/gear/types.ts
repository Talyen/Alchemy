import { characters, type CharacterId, type KeywordId } from "@/lib/game-data";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { GearAffixId } from "./affix-ids";
import type { GearBaseItemId } from "./base-items";
import type { GearDefinitionId } from "./definitions";

export type { GearEffectManifest } from "./gear-effect-manifest";
export { defaultGearEffects, GEAR_EFFECT_KEYS } from "./gear-effect-manifest";

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

export type GearSlot = (typeof GEAR_SLOTS)[number];
export type GearRarity = "basic" | "astral";

export const GEAR_RARITIES = ["basic", "astral"] as const satisfies readonly GearRarity[];

export type { GearAffixId } from "./affix-ids";
export type { GearBaseItemId } from "./base-items";
export type { GearDefinitionId } from "./definitions";

export interface GearAffixRoll {
  id: GearAffixId;
  value: number;
}

export interface GearDefinition {
  id: string;
  baseItemId: GearBaseItemId;
  rarity: GearRarity | null;
  title: string;
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
  definitionId: GearDefinitionId;
  affixes: GearAffixRoll[];
}

export type GearInventory = GearInstance[];
export type GearInventories = Record<GearCharacterId, GearInventory>;
export type GearLoadout = Record<GearSlot, string | null>;
export type GearLoadouts = Record<GearCharacterId, GearLoadout>;

export interface GearBoardPosition {
  col: number;
  row: number;
}
export type GearBoardPositions = Record<string, GearBoardPosition>;
export type GearBoardPositionsByCharacter = Record<GearCharacterId, GearBoardPositions>;

export function createEmptyGearInventories(): GearInventories {
  return Object.fromEntries(GEAR_CHARACTER_IDS.map((id) => [id, [] as GearInventory])) as GearInventories;
}

export function createEmptyGearBoardPositionsByCharacter(): GearBoardPositionsByCharacter {
  return Object.fromEntries(GEAR_CHARACTER_IDS.map((id) => [id, {}])) as GearBoardPositionsByCharacter;
}

export function flattenGearInventories(inventories: GearInventories): GearInventory {
  return GEAR_CHARACTER_IDS.flatMap((id) => inventories[id]);
}

export function findGearEquippedCharacter(loadouts: GearLoadouts, instanceId: string): GearCharacterId | null {
  for (const characterId of GEAR_CHARACTER_IDS) {
    for (const slot of GEAR_SLOTS) {
      if (loadouts[characterId][slot] === instanceId) return characterId;
    }
  }
  return null;
}

export function findGearInventoryOwner(inventories: GearInventories, instanceId: string): GearCharacterId | null {
  for (const characterId of GEAR_CHARACTER_IDS) {
    if (inventories[characterId].some((item) => item.instanceId === instanceId)) {
      return characterId;
    }
  }
  return null;
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
