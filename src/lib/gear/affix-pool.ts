import { takeRandomItem } from "@/lib/utils";
import { affixMatchesAffinity, rollAffixValue } from "./affixes";
import { gearAffixList, type GearAffixAspect, type GearAffixDefinition } from "./affix-catalog";
import type { GearDefinition } from "./definitions";
import type { GearAffixRoll, GearSlot } from "./types";

const SHIELD_BASE_ITEM_IDS = new Set(["leather-buckler", "kite-shield"]);
const OFF_HAND_OFFENSIVE_BASE_ITEMS = new Set(["quiver", "spellbook"]);
const JEWELRY_SLOTS = new Set<GearSlot>(["left-accessory", "right-accessory"]);

function allowedAspectsForDefinition(def: GearDefinition): GearAffixAspect[] {
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
  return ["defensive"];
}

const eligibleAffixPoolCache = new Map<string, readonly GearAffixDefinition[]>();

function eligibleAffixCacheKey(definition: GearDefinition): string {
  // Safe to key on base item: buildVariantDefinitions copies compatibleSlots
  // and affinityKeywords straight from the base item, so same base always
  // yields the same pool. The cached array is frozen; copy before mutating.
  return definition.baseItemId;
}

export function buildEligibleAffixPool(definition: GearDefinition): readonly GearAffixDefinition[] {
  const cacheKey = eligibleAffixCacheKey(definition);
  const cached = eligibleAffixPoolCache.get(cacheKey);
  if (cached) return cached;
  const allowedAspects = new Set(allowedAspectsForDefinition(definition));
  const pool = Object.freeze(
    gearAffixList.filter(
      (affix) =>
        !affix.uniqueOnly &&
        allowedAspects.has(affix.aspect) &&
        affixMatchesAffinity(affix, definition.affinityKeywords),
    ),
  );
  eligibleAffixPoolCache.set(cacheKey, pool);
  return pool;
}

export function rollAffixes(definition: GearDefinition, count: number, rng: () => number): GearAffixRoll[] {
  const pool = buildEligibleAffixPool(definition);
  const effectiveCount = Math.min(count, pool.length);
  const selected: GearAffixRoll[] = [];
  const remaining = [...pool];
  const rarity = definition.rarity ?? "basic";

  for (let pick = 0; pick < effectiveCount; pick += 1) {
    const chosen = takeRandomItem(remaining, rng);
    if (!chosen) break;
    selected.push({ id: chosen.id, value: rollAffixValue(chosen, rarity, rng) });
  }

  return selected;
}
