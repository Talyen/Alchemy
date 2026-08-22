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

type GearBaseItemInput = Omit<GearBaseItemDefinition, "id" | "availableRarities" | "rangedWeapon"> & {
  availableRarities?: readonly GearRarity[];
  rangedWeapon?: boolean;
};
type GearBaseItemCatalog<T extends Record<string, GearBaseItemInput>> = {
  [K in keyof T]: GearBaseItemDefinition;
};

const DEFAULT_AVAILABLE_RARITIES: readonly GearRarity[] = ["basic", "astral"];

function defineGearBaseItems<const T extends Record<string, GearBaseItemInput>>(items: T): GearBaseItemCatalog<T> {
  return Object.fromEntries(
    Object.entries(items).map(([id, definition]) => [
      id,
      {
        id,
        ...definition,
        availableRarities: definition.availableRarities ?? DEFAULT_AVAILABLE_RARITIES,
        rangedWeapon: definition.rangedWeapon ?? false,
      },
    ]),
  ) as GearBaseItemCatalog<T>;
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

export const gearBaseItems = defineGearBaseItems({
  "double-axe": {
    displayName: "Double Axe",
    compatibleSlots: ["main-hand"],
    requiresTwoHands: true,
    affinityKeywords: ["physical", "stun", "bleed"],
    salvageByRarity: ironHeavy,
  },
  maul: {
    displayName: "Maul",
    compatibleSlots: ["main-hand"],
    requiresTwoHands: true,
    affinityKeywords: ["physical", "stun", "holy"],
    salvageByRarity: ironHeavy,
  },
  greatsword: {
    displayName: "Greatsword",
    compatibleSlots: ["main-hand"],
    requiresTwoHands: true,
    affinityKeywords: ["physical", "stun", "forge"],
    salvageByRarity: ironHeavy,
  },
  hatchet: {
    displayName: "Hatchet",
    compatibleSlots: ["main-hand", "off-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["physical", "bleed"],
    salvageByRarity: salvageBy({ iron: 3, wood: 3 }, { iron: 6, wood: 3 }),
  },
  longsword: {
    displayName: "Longsword",
    compatibleSlots: ["main-hand", "off-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["physical", "forge", "holy"],
    salvageByRarity: ironMedium,
  },
  shortsword: {
    displayName: "Shortsword",
    compatibleSlots: ["main-hand", "off-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["physical", "forge", "bleed"],
    salvageByRarity: ironLight,
  },
  dagger: {
    displayName: "Dagger",
    compatibleSlots: ["main-hand", "off-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["physical", "bleed", "poison"],
    salvageByRarity: salvageBy({ iron: 3 }, { iron: 3, herbs: 3 }),
  },
  mace: {
    displayName: "Mace",
    compatibleSlots: ["main-hand", "off-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["physical", "stun", "holy"],
    salvageByRarity: ironMedium,
  },
  flail: {
    displayName: "Flail",
    compatibleSlots: ["main-hand", "off-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["physical", "stun"],
    salvageByRarity: ironMedium,
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
  },
  wand: {
    displayName: "Wand",
    compatibleSlots: ["main-hand", "off-hand"],
    requiresTwoHands: false,
    affinityKeywords: ["burn", "freeze", "mana"],
    salvageByRarity: salvageBy({ wood: 3 }, { wood: 3, crystal: 3 }),
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
});

export type GearBaseItemId = keyof typeof gearBaseItems;

export const gearBaseItemList = Object.values(gearBaseItems);
