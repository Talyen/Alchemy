import { characters, type CharacterId } from "@/lib/game-data";
import type { MaterialInventory } from "@/lib/homestead/types";

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
export const GEAR_DEFINITION_IDS = [
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
export type GearDefinitionId = (typeof GEAR_DEFINITION_IDS)[number];
export type GearModifier = { kind: "flatPhysicalDamage"; value: number };
export type GearEffectManifest = { flatPhysicalDamage: number };
export const defaultGearEffects: GearEffectManifest = { flatPhysicalDamage: 0 };
export type GearDefinition = {
  id: GearDefinitionId;
  title: string;
  descriptionLines: string[];
  art: string;
  compatibleSlots: GearSlot[];
  effects: GearEffectManifest;
  salvageValue: MaterialInventory;
};
export type GearInstance = { instanceId: string; definitionId: GearDefinitionId; modifiers: GearModifier[] };
export type GearInventory = GearInstance[];
export type GearLoadout = Record<GearSlot, string | null>;
export type GearLoadouts = Record<GearCharacterId, GearLoadout>;

export function createEmptyGearLoadout(): GearLoadout {
  return Object.fromEntries(GEAR_SLOTS.map((slot) => [slot, null])) as GearLoadout;
}
export function createEmptyGearLoadouts(): GearLoadouts {
  return Object.fromEntries(GEAR_CHARACTER_IDS.map((id) => [id, createEmptyGearLoadout()])) as GearLoadouts;
}
