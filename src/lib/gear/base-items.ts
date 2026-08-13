import type { KeywordId } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { GearRarity, GearSlot } from "./types-core";

export interface GearBaseItemDefinition {
  id: string;
  displayName: string;
  compatibleSlots: GearSlot[];
  requiresTwoHands: boolean;
  affinityKeywords: KeywordId[];
  availableRarities: readonly GearRarity[];
  salvageByRarity: Record<GearRarity, MaterialInventory>;
  rangedWeapon?: boolean;
  quiver?: boolean;
}

type GearBaseItemInput = Omit<GearBaseItemDefinition, "id">;
type GearBaseItemCatalog<T extends Record<string, GearBaseItemInput>> = {
  [K in keyof T]: GearBaseItemDefinition;
};

function defineGearBaseItems<const T extends Record<string, GearBaseItemInput>>(items: T): GearBaseItemCatalog<T> {
  return Object.fromEntries(
    Object.entries(items).map(([id, definition]) => [id, { id, ...definition }]),
  ) as GearBaseItemCatalog<T>;
}

function salvage(basicIron: number, astralIron: number, astralCrystal = 1): Record<GearRarity, MaterialInventory> {
  return {
    basic: { ...emptyInventory(), iron: basicIron },
    astral: { ...emptyInventory(), iron: astralIron, crystal: astralCrystal },
  };
}

const lightSalvage = salvage(1, 2);
const mediumSalvage = salvage(2, 3);
const heavySalvage = salvage(3, 4);

export const gearBaseItems = defineGearBaseItems({
  "double-axe": {
    displayName: "Double Axe",
    compatibleSlots: ["main-hand"],
    requiresTwoHands: true,
    affinityKeywords: ["physical", "stun", "bleed"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: heavySalvage,
    rangedWeapon: false,
  },
  maul: {
    displayName: "Maul",
    compatibleSlots: ["main-hand"],
    requiresTwoHands: true,
    affinityKeywords: ["physical", "stun", "holy"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: heavySalvage,
    rangedWeapon: false,
  },
  greatsword: {
    displayName: "Greatsword",
    compatibleSlots: ["main-hand"],
    requiresTwoHands: true,
    affinityKeywords: ["physical", "stun", "forge"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: heavySalvage,
    rangedWeapon: false,
  },
  hatchet: {
    displayName: "Hatchet",
    compatibleSlots: ["main-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["physical", "bleed"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: mediumSalvage,
    rangedWeapon: false,
  },
  longsword: {
    displayName: "Longsword",
    compatibleSlots: ["main-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["physical", "forge", "holy"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: mediumSalvage,
    rangedWeapon: false,
  },
  shortsword: {
    displayName: "Shortsword",
    compatibleSlots: ["main-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["physical", "forge", "bleed"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: lightSalvage,
    rangedWeapon: false,
  },
  dagger: {
    displayName: "Dagger",
    compatibleSlots: ["main-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["physical", "bleed", "poison"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: lightSalvage,
    rangedWeapon: false,
  },
  mace: {
    displayName: "Mace",
    compatibleSlots: ["main-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["physical", "stun", "holy"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: mediumSalvage,
    rangedWeapon: false,
  },
  flail: {
    displayName: "Flail",
    compatibleSlots: ["main-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["physical", "stun"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: mediumSalvage,
    rangedWeapon: false,
  },
  longbow: {
    displayName: "Longbow",
    compatibleSlots: ["main-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["archery", "physical", "nature", "companion"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: mediumSalvage,
    rangedWeapon: true,
  },
  shortbow: {
    displayName: "Shortbow",
    compatibleSlots: ["main-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["archery", "physical", "nature", "companion"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: lightSalvage,
    rangedWeapon: true,
  },
  "recurve-bow": {
    displayName: "Recurve Bow",
    compatibleSlots: ["main-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["archery", "nature", "physical", "companion"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: mediumSalvage,
    rangedWeapon: true,
  },
  crossbow: {
    displayName: "Crossbow",
    compatibleSlots: ["main-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["archery", "physical"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: heavySalvage,
    rangedWeapon: true,
  },
  staff: {
    displayName: "Staff",
    compatibleSlots: ["main-hand"],
    requiresTwoHands: true,
    affinityKeywords: ["burn", "freeze", "mana"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: mediumSalvage,
    rangedWeapon: false,
  },
  wand: {
    displayName: "Wand",
    compatibleSlots: ["main-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["burn", "freeze", "mana"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: lightSalvage,
    rangedWeapon: false,
  },
  "leather-buckler": {
    displayName: "Leather Buckler",
    compatibleSlots: ["off-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["block", "armor", "physical"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: lightSalvage,
  },
  "kite-shield": {
    displayName: "Kite Shield",
    compatibleSlots: ["off-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["block", "armor", "stun", "physical"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: heavySalvage,
  },
  quiver: {
    displayName: "Quiver",
    compatibleSlots: ["off-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["archery", "physical"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: lightSalvage,
    quiver: true,
  },
  spellbook: {
    displayName: "Spellbook",
    compatibleSlots: ["off-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["burn", "freeze", "holy"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: mediumSalvage,
  },
  "leather-armor": {
    displayName: "Leather Armor",
    compatibleSlots: ["body"],
    requiresTwoHands: false,
    affinityKeywords: ["physical", "health", "armor"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: mediumSalvage,
  },
  "plate-armor": {
    displayName: "Plate Armor",
    compatibleSlots: ["body"],
    requiresTwoHands: false,
    affinityKeywords: ["armor", "block", "stun", "physical"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: heavySalvage,
  },
  "ruby-ring": {
    displayName: "Ruby Ring",
    compatibleSlots: ["left-ring", "right-ring"],
    requiresTwoHands: false,
    affinityKeywords: ["burn", "bleed", "leech"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: lightSalvage,
  },
  "sapphire-ring": {
    displayName: "Sapphire Ring",
    compatibleSlots: ["left-ring", "right-ring"],
    requiresTwoHands: false,
    affinityKeywords: ["freeze", "mana", "block"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: lightSalvage,
  },
  "emerald-ring": {
    displayName: "Emerald Ring",
    compatibleSlots: ["left-ring", "right-ring"],
    requiresTwoHands: false,
    affinityKeywords: ["nature", "poison", "archery"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: lightSalvage,
  },
  "topaz-ring": {
    displayName: "Topaz Ring",
    compatibleSlots: ["left-ring", "right-ring"],
    requiresTwoHands: false,
    affinityKeywords: ["holy", "gold", "forge", "stun"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: lightSalvage,
  },
  "ruby-amulet": {
    displayName: "Ruby Amulet",
    compatibleSlots: ["amulet"],
    requiresTwoHands: false,
    affinityKeywords: ["burn", "bleed", "leech"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: lightSalvage,
  },
  "sapphire-amulet": {
    displayName: "Sapphire Amulet",
    compatibleSlots: ["amulet"],
    requiresTwoHands: false,
    affinityKeywords: ["freeze", "mana", "block"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: lightSalvage,
  },
  "emerald-amulet": {
    displayName: "Emerald Amulet",
    compatibleSlots: ["amulet"],
    requiresTwoHands: false,
    affinityKeywords: ["nature", "poison", "archery"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: lightSalvage,
  },
  "topaz-amulet": {
    displayName: "Topaz Amulet",
    compatibleSlots: ["amulet"],
    requiresTwoHands: false,
    affinityKeywords: ["holy", "gold", "forge", "stun"],
    availableRarities: ["basic", "astral"],
    salvageByRarity: lightSalvage,
  },
});

export type GearBaseItemId = keyof typeof gearBaseItems;

export const gearBaseItemList = Object.values(gearBaseItems);
