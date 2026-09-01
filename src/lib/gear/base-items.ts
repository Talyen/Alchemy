import type { KeywordId } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { GearRarity, GearSlot } from "./types-core";

export type GearSlotRule = "two-handed" | "ranged" | "quiver" | "standard";

export interface GearBaseItemDefinition {
  id: string;
  displayName: string;
  compatibleSlots: GearSlot[];
  slotRule: GearSlotRule;
  affinityKeywords: KeywordId[];
  salvageByRarity: Record<GearRarity, MaterialInventory>;
}

function salvageBy(
  basic: Partial<MaterialInventory>,
  astral: Partial<MaterialInventory>,
  unique?: Partial<MaterialInventory>,
): Record<GearRarity, MaterialInventory> {
  return {
    basic: { ...emptyInventory(), ...basic },
    astral: { ...emptyInventory(), ...astral },
    unique: { ...emptyInventory(), ...(unique ?? astral) },
  };
}

const ironLight = salvageBy({ iron: 3 }, { iron: 6 });
const ironMedium = salvageBy({ iron: 6 }, { iron: 9 });
const ironHeavy = salvageBy({ iron: 9 }, { iron: 12 });
const woodLight = salvageBy({ wood: 3 }, { wood: 6 });
const woodMedium = salvageBy({ wood: 6 }, { wood: 9 });
const gemLight = salvageBy({ gems: 3 }, { gems: 6 });
const natureGem = salvageBy({ gems: 3 }, { gems: 3, herbs: 3 });

const gearBaseItemCatalog = {
  "double-axe": {
    displayName: "Double Axe",
    compatibleSlots: ["main-hand"],
    slotRule: "two-handed",
    affinityKeywords: ["physical", "stun", "bleed"],
    salvageByRarity: ironHeavy,
  },
  maul: {
    displayName: "Maul",
    compatibleSlots: ["main-hand"],
    slotRule: "two-handed",
    affinityKeywords: ["physical", "stun", "holy"],
    salvageByRarity: ironHeavy,
  },
  greatsword: {
    displayName: "Greatsword",
    compatibleSlots: ["main-hand"],
    slotRule: "two-handed",
    affinityKeywords: ["physical", "stun", "forge"],
    salvageByRarity: ironHeavy,
  },
  hatchet: {
    displayName: "Hatchet",
    compatibleSlots: ["main-hand", "off-hand"],
    slotRule: "standard",
    affinityKeywords: ["physical", "bleed"],
    salvageByRarity: salvageBy({ iron: 3, wood: 3 }, { iron: 6, wood: 3 }),
  },
  longsword: {
    displayName: "Longsword",
    compatibleSlots: ["main-hand", "off-hand"],
    slotRule: "standard",
    affinityKeywords: ["physical", "forge", "holy"],
    salvageByRarity: ironMedium,
  },
  shortsword: {
    displayName: "Shortsword",
    compatibleSlots: ["main-hand", "off-hand"],
    slotRule: "standard",
    affinityKeywords: ["physical", "forge", "bleed"],
    salvageByRarity: ironLight,
  },
  dagger: {
    displayName: "Dagger",
    compatibleSlots: ["main-hand", "off-hand"],
    slotRule: "standard",
    affinityKeywords: ["physical", "bleed", "poison", "dodge"],
    salvageByRarity: salvageBy({ iron: 3 }, { iron: 3, herbs: 3 }),
  },
  mace: {
    displayName: "Mace",
    compatibleSlots: ["main-hand", "off-hand"],
    slotRule: "standard",
    affinityKeywords: ["physical", "stun", "holy"],
    salvageByRarity: ironMedium,
  },
  flail: {
    displayName: "Flail",
    compatibleSlots: ["main-hand", "off-hand"],
    slotRule: "standard",
    affinityKeywords: ["physical", "stun"],
    salvageByRarity: ironMedium,
  },
  longbow: {
    displayName: "Longbow",
    compatibleSlots: ["main-hand"],
    slotRule: "ranged",
    affinityKeywords: ["archery", "physical", "nature", "companion"],
    salvageByRarity: woodMedium,
  },
  shortbow: {
    displayName: "Shortbow",
    compatibleSlots: ["main-hand"],
    slotRule: "ranged",
    affinityKeywords: ["archery", "physical", "nature", "companion", "dodge"],
    salvageByRarity: woodLight,
  },
  "recurve-bow": {
    displayName: "Recurve Bow",
    compatibleSlots: ["main-hand"],
    slotRule: "ranged",
    affinityKeywords: ["archery", "nature", "physical", "companion"],
    salvageByRarity: salvageBy({ wood: 6 }, { wood: 6, herbs: 3 }),
  },
  crossbow: {
    displayName: "Crossbow",
    compatibleSlots: ["main-hand"],
    slotRule: "ranged",
    affinityKeywords: ["archery", "physical"],
    salvageByRarity: salvageBy({ wood: 6, iron: 3 }, { wood: 6, iron: 6 }),
  },
  staff: {
    displayName: "Staff",
    compatibleSlots: ["main-hand"],
    slotRule: "two-handed",
    affinityKeywords: ["burn", "freeze", "mana"],
    salvageByRarity: salvageBy({ wood: 3, gems: 3 }, { wood: 6, gems: 3 }),
  },
  wand: {
    displayName: "Wand",
    compatibleSlots: ["main-hand", "off-hand"],
    slotRule: "standard",
    affinityKeywords: ["burn", "freeze", "mana"],
    salvageByRarity: salvageBy({ wood: 3 }, { wood: 3, gems: 3 }),
  },
  "leather-buckler": {
    displayName: "Leather Buckler",
    compatibleSlots: ["off-hand"],
    slotRule: "standard",
    affinityKeywords: ["block", "armor", "physical", "dodge"],
    salvageByRarity: woodLight,
  },
  "kite-shield": {
    displayName: "Kite Shield",
    compatibleSlots: ["off-hand"],
    slotRule: "standard",
    affinityKeywords: ["block", "armor", "stun", "physical"],
    salvageByRarity: ironHeavy,
  },
  quiver: {
    displayName: "Quiver",
    compatibleSlots: ["off-hand"],
    slotRule: "quiver",
    affinityKeywords: ["archery", "physical", "dodge"],
    salvageByRarity: woodLight,
  },
  spellbook: {
    displayName: "Spellbook",
    compatibleSlots: ["off-hand"],
    slotRule: "standard",
    affinityKeywords: ["burn", "freeze", "holy"],
    salvageByRarity: salvageBy({ herbs: 3, gems: 3 }, { herbs: 6, gems: 3 }),
  },
  "leather-armor": {
    displayName: "Leather Armor",
    compatibleSlots: ["body"],
    slotRule: "standard",
    affinityKeywords: ["physical", "health", "armor", "dodge"],
    salvageByRarity: salvageBy({ herbs: 6 }, { herbs: 9 }),
  },
  "plate-armor": {
    displayName: "Plate Armor",
    compatibleSlots: ["body"],
    slotRule: "standard",
    affinityKeywords: ["armor", "block", "stun", "physical"],
    salvageByRarity: ironHeavy,
  },
  "ruby-ring": {
    displayName: "Ruby Ring",
    compatibleSlots: ["left-accessory", "right-accessory"],
    slotRule: "standard",
    affinityKeywords: ["burn", "bleed", "leech"],
    salvageByRarity: gemLight,
  },
  "sapphire-ring": {
    displayName: "Sapphire Ring",
    compatibleSlots: ["left-accessory", "right-accessory"],
    slotRule: "standard",
    affinityKeywords: ["freeze", "mana", "block"],
    salvageByRarity: gemLight,
  },
  "emerald-ring": {
    displayName: "Emerald Ring",
    compatibleSlots: ["left-accessory", "right-accessory"],
    slotRule: "standard",
    affinityKeywords: ["nature", "poison", "archery", "dodge"],
    salvageByRarity: natureGem,
  },
  "topaz-ring": {
    displayName: "Topaz Ring",
    compatibleSlots: ["left-accessory", "right-accessory"],
    slotRule: "standard",
    affinityKeywords: ["holy", "gold", "forge", "stun"],
    salvageByRarity: gemLight,
  },
  "ruby-amulet": {
    displayName: "Ruby Amulet",
    compatibleSlots: ["left-accessory", "right-accessory"],
    slotRule: "standard",
    affinityKeywords: ["burn", "bleed", "leech"],
    salvageByRarity: gemLight,
  },
  "sapphire-amulet": {
    displayName: "Sapphire Amulet",
    compatibleSlots: ["left-accessory", "right-accessory"],
    slotRule: "standard",
    affinityKeywords: ["freeze", "mana", "block"],
    salvageByRarity: gemLight,
  },
  "emerald-amulet": {
    displayName: "Emerald Amulet",
    compatibleSlots: ["left-accessory", "right-accessory"],
    slotRule: "standard",
    affinityKeywords: ["nature", "poison", "archery", "dodge"],
    salvageByRarity: natureGem,
  },
  "topaz-amulet": {
    displayName: "Topaz Amulet",
    compatibleSlots: ["left-accessory", "right-accessory"],
    slotRule: "standard",
    affinityKeywords: ["holy", "gold", "forge", "stun"],
    salvageByRarity: gemLight,
  },
} satisfies Record<string, Omit<GearBaseItemDefinition, "id">>;

export type GearBaseItemId = keyof typeof gearBaseItemCatalog;

export const gearBaseItems = Object.fromEntries(
  Object.entries(gearBaseItemCatalog).map(([id, item]) => [id, { ...item, id }]),
) as Record<GearBaseItemId, GearBaseItemDefinition>;

export const gearBaseItemList = Object.values(gearBaseItems);
