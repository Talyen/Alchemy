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
  salvageByRarity: Record<GearRarity, MaterialInventory>;
  /** Explicit on every main-hand item so ranged tagging is a data-level decision. */
  rangedWeapon?: boolean;
  quiver?: boolean;
}

function salvageBy(
  basic: Partial<MaterialInventory>,
  astral: Partial<MaterialInventory>,
): Record<GearRarity, MaterialInventory> {
  return {
    basic: { ...emptyInventory(), ...basic },
    astral: { ...emptyInventory(), ...astral },
  };
}

const ironLight = salvageBy({ iron: 3 }, { iron: 6 });
const ironMedium = salvageBy({ iron: 6 }, { iron: 9 });
const ironHeavy = salvageBy({ iron: 9 }, { iron: 12 });
const woodLight = salvageBy({ wood: 3 }, { wood: 6 });
const woodMedium = salvageBy({ wood: 6 }, { wood: 9 });
const gemLight = salvageBy({ crystal: 3 }, { crystal: 6 });
const natureGem = salvageBy({ crystal: 3 }, { crystal: 3, herbs: 3 });

const gearBaseItemCatalog = {
  "double-axe": {
    displayName: "Double Axe",
    compatibleSlots: ["main-hand"],
    requiresTwoHands: true,
    affinityKeywords: ["physical", "stun", "bleed"],
    salvageByRarity: ironHeavy,
    rangedWeapon: false,
  },
  maul: {
    displayName: "Maul",
    compatibleSlots: ["main-hand"],
    requiresTwoHands: true,
    affinityKeywords: ["physical", "stun", "holy"],
    salvageByRarity: ironHeavy,
    rangedWeapon: false,
  },
  greatsword: {
    displayName: "Greatsword",
    compatibleSlots: ["main-hand"],
    requiresTwoHands: true,
    affinityKeywords: ["physical", "stun", "forge"],
    salvageByRarity: ironHeavy,
    rangedWeapon: false,
  },
  hatchet: {
    displayName: "Hatchet",
    compatibleSlots: ["main-hand", "off-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["physical", "bleed"],
    salvageByRarity: salvageBy({ iron: 3, wood: 3 }, { iron: 6, wood: 3 }),
    rangedWeapon: false,
  },
  longsword: {
    displayName: "Longsword",
    compatibleSlots: ["main-hand", "off-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["physical", "forge", "holy"],
    salvageByRarity: ironMedium,
    rangedWeapon: false,
  },
  shortsword: {
    displayName: "Shortsword",
    compatibleSlots: ["main-hand", "off-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["physical", "forge", "bleed"],
    salvageByRarity: ironLight,
    rangedWeapon: false,
  },
  dagger: {
    displayName: "Dagger",
    compatibleSlots: ["main-hand", "off-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["physical", "bleed", "poison"],
    salvageByRarity: salvageBy({ iron: 3 }, { iron: 3, herbs: 3 }),
    rangedWeapon: false,
  },
  mace: {
    displayName: "Mace",
    compatibleSlots: ["main-hand", "off-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["physical", "stun", "holy"],
    salvageByRarity: ironMedium,
    rangedWeapon: false,
  },
  flail: {
    displayName: "Flail",
    compatibleSlots: ["main-hand", "off-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["physical", "stun"],
    salvageByRarity: ironMedium,
    rangedWeapon: false,
  },
  longbow: {
    displayName: "Longbow",
    compatibleSlots: ["main-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["archery", "physical", "nature", "companion"],
    salvageByRarity: woodMedium,
    rangedWeapon: true,
  },
  shortbow: {
    displayName: "Shortbow",
    compatibleSlots: ["main-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["archery", "physical", "nature", "companion"],
    salvageByRarity: woodLight,
    rangedWeapon: true,
  },
  "recurve-bow": {
    displayName: "Recurve Bow",
    compatibleSlots: ["main-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["archery", "nature", "physical", "companion"],
    salvageByRarity: salvageBy({ wood: 6 }, { wood: 6, herbs: 3 }),
    rangedWeapon: true,
  },
  crossbow: {
    displayName: "Crossbow",
    compatibleSlots: ["main-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["archery", "physical"],
    salvageByRarity: salvageBy({ wood: 6, iron: 3 }, { wood: 6, iron: 6 }),
    rangedWeapon: true,
  },
  staff: {
    displayName: "Staff",
    compatibleSlots: ["main-hand"],
    requiresTwoHands: true,
    affinityKeywords: ["burn", "freeze", "mana"],
    salvageByRarity: salvageBy({ wood: 3, crystal: 3 }, { wood: 6, crystal: 3 }),
    rangedWeapon: false,
  },
  wand: {
    displayName: "Wand",
    compatibleSlots: ["main-hand", "off-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["burn", "freeze", "mana"],
    salvageByRarity: salvageBy({ wood: 3 }, { wood: 3, crystal: 3 }),
    rangedWeapon: false,
  },
  "leather-buckler": {
    displayName: "Leather Buckler",
    compatibleSlots: ["off-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["block", "armor", "physical"],
    salvageByRarity: woodLight,
  },
  "kite-shield": {
    displayName: "Kite Shield",
    compatibleSlots: ["off-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["block", "armor", "stun", "physical"],
    salvageByRarity: ironHeavy,
  },
  quiver: {
    displayName: "Quiver",
    compatibleSlots: ["off-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["archery", "physical"],
    salvageByRarity: woodLight,
    quiver: true,
  },
  spellbook: {
    displayName: "Spellbook",
    compatibleSlots: ["off-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["burn", "freeze", "holy"],
    salvageByRarity: salvageBy({ herbs: 3, crystal: 3 }, { herbs: 6, crystal: 3 }),
  },
  "leather-armor": {
    displayName: "Leather Armor",
    compatibleSlots: ["body"],
    requiresTwoHands: false,
    affinityKeywords: ["physical", "health", "armor"],
    salvageByRarity: salvageBy({ herbs: 6 }, { herbs: 9 }),
  },
  "plate-armor": {
    displayName: "Plate Armor",
    compatibleSlots: ["body"],
    requiresTwoHands: false,
    affinityKeywords: ["armor", "block", "stun", "physical"],
    salvageByRarity: ironHeavy,
  },
  "ruby-ring": {
    displayName: "Ruby Ring",
    compatibleSlots: ["left-ring", "right-ring"],
    requiresTwoHands: false,
    affinityKeywords: ["burn", "bleed", "leech"],
    salvageByRarity: gemLight,
  },
  "sapphire-ring": {
    displayName: "Sapphire Ring",
    compatibleSlots: ["left-ring", "right-ring"],
    requiresTwoHands: false,
    affinityKeywords: ["freeze", "mana", "block"],
    salvageByRarity: gemLight,
  },
  "emerald-ring": {
    displayName: "Emerald Ring",
    compatibleSlots: ["left-ring", "right-ring"],
    requiresTwoHands: false,
    affinityKeywords: ["nature", "poison", "archery"],
    salvageByRarity: natureGem,
  },
  "topaz-ring": {
    displayName: "Topaz Ring",
    compatibleSlots: ["left-ring", "right-ring"],
    requiresTwoHands: false,
    affinityKeywords: ["holy", "gold", "forge", "stun"],
    salvageByRarity: gemLight,
  },
  "ruby-amulet": {
    displayName: "Ruby Amulet",
    compatibleSlots: ["amulet"],
    requiresTwoHands: false,
    affinityKeywords: ["burn", "bleed", "leech"],
    salvageByRarity: gemLight,
  },
  "sapphire-amulet": {
    displayName: "Sapphire Amulet",
    compatibleSlots: ["amulet"],
    requiresTwoHands: false,
    affinityKeywords: ["freeze", "mana", "block"],
    salvageByRarity: gemLight,
  },
  "emerald-amulet": {
    displayName: "Emerald Amulet",
    compatibleSlots: ["amulet"],
    requiresTwoHands: false,
    affinityKeywords: ["nature", "poison", "archery"],
    salvageByRarity: natureGem,
  },
  "topaz-amulet": {
    displayName: "Topaz Amulet",
    compatibleSlots: ["amulet"],
    requiresTwoHands: false,
    affinityKeywords: ["holy", "gold", "forge", "stun"],
    salvageByRarity: gemLight,
  },
} satisfies Record<string, Omit<GearBaseItemDefinition, "id">>;

export type GearBaseItemId = keyof typeof gearBaseItemCatalog;

export const gearBaseItems = Object.fromEntries(
  Object.entries(gearBaseItemCatalog).map(([id, item]) => [id, { ...item, id }]),
) as Record<GearBaseItemId, GearBaseItemDefinition>;

export const gearBaseItemList = Object.values(gearBaseItems);
