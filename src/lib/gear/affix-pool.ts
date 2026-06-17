import { affixMatchesAffinity, gearAffixList, type GearAffixDefinition } from "./affixes";
import type { GearAffixAspect } from "./affix-catalog";
import type { GearDefinition, GearSlot } from "./types";

const SHIELD_BASE_ITEM_IDS = new Set(["leather-buckler", "kite-shield"]);
const OFF_HAND_OFFENSIVE_BASE_ITEMS = new Set(["quiver", "spellbook"]);
const JEWELRY_SLOTS = new Set<GearSlot>(["left-ring", "right-ring", "amulet"]);
const ARMOR_SLOTS = new Set<GearSlot>(["body", "helm", "boots", "gloves", "belt"]);

export function allowedAspectsForDefinition(def: GearDefinition): GearAffixAspect[] {
  if (SHIELD_BASE_ITEM_IDS.has(def.baseItemId)) {
    return ["offensive", "defensive"];
  }
  if (def.compatibleSlots.some((slot) => JEWELRY_SLOTS.has(slot))) {
    return ["offensive", "defensive"];
  }
  if (def.compatibleSlots.includes("main-hand")) {
    return ["offensive"];
  }
  if (def.compatibleSlots.includes("off-hand") && OFF_HAND_OFFENSIVE_BASE_ITEMS.has(def.baseItemId)) {
    return ["offensive"];
  }
  if (def.compatibleSlots.some((slot) => ARMOR_SLOTS.has(slot))) {
    return ["defensive"];
  }
  return ["defensive"];
}

export function buildEligibleAffixPool(definition: GearDefinition): GearAffixDefinition[] {
  const allowedAspects = new Set(allowedAspectsForDefinition(definition));
  return gearAffixList.filter(
    (affix) => allowedAspects.has(affix.aspect) && affixMatchesAffinity(affix, definition.affinityKeywords),
  );
}
