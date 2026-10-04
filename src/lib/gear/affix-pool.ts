import { takeRandomItem } from "@/lib/rng";
import { affixMatchesAffinity, rollAffixValue } from "./affixes";
import { gearAffixList, type GearAffixAspect, type GearAffixDefinition } from "./affix-catalog";
import type { GearDefinition } from "./definitions";
import type { GearAffixRoll, GearSlot } from "./types";

const SHIELD_BASE_ITEM_IDS = new Set(["leather-buckler", "kite-shield"]);
const OFF_HAND_OFFENSIVE_BASE_ITEMS = new Set(["quiver", "spellbook"]);
const JEWELRY_SLOTS = new Set<GearSlot>(["left-accessory", "right-accessory"]);

/** null permits both aspects; ordinary weapons and armor permit one. */
function requiredAspect(def: GearDefinition): GearAffixAspect | null {
  if (SHIELD_BASE_ITEM_IDS.has(def.baseItemId) || def.compatibleSlots.some((slot) => JEWELRY_SLOTS.has(slot)))
    return null;
  return def.compatibleSlots.includes("main-hand") ||
    (def.compatibleSlots.includes("off-hand") && OFF_HAND_OFFENSIVE_BASE_ITEMS.has(def.baseItemId))
    ? "offensive"
    : "defensive";
}

interface CachedAffixPool {
  baseItemId: string;
  compatibleSlots: readonly GearSlot[];
  affinityKeywords: readonly string[];
  pool: readonly GearAffixDefinition[];
}

// Catalog definitions recur throughout reward generation and crafting previews.
// Weak ownership also lets temporary definitions and their pools be collected.
const eligibleAffixPoolCache = new WeakMap<GearDefinition, CachedAffixPool>();

export function buildEligibleAffixPool(definition: GearDefinition): readonly GearAffixDefinition[] {
  const cached = eligibleAffixPoolCache.get(definition);
  // Compare values rather than just array identity: callers can edit custom
  // definitions in place. Stable lookups need no sorting or temporary arrays.
  if (
    cached &&
    cached.baseItemId === definition.baseItemId &&
    cached.compatibleSlots.length === definition.compatibleSlots.length &&
    cached.compatibleSlots.every((slot, index) => slot === definition.compatibleSlots[index]) &&
    cached.affinityKeywords.length === definition.affinityKeywords.length &&
    cached.affinityKeywords.every((keyword, index) => keyword === definition.affinityKeywords[index])
  )
    return cached.pool;
  const aspect = requiredAspect(definition);
  const pool = Object.freeze(
    gearAffixList.filter(
      (affix) =>
        !affix.uniqueOnly &&
        (aspect === null || affix.aspect === aspect) &&
        affixMatchesAffinity(affix, definition.affinityKeywords),
    ),
  );
  eligibleAffixPoolCache.set(definition, {
    baseItemId: definition.baseItemId,
    compatibleSlots: [...definition.compatibleSlots],
    affinityKeywords: [...definition.affinityKeywords],
    pool,
  });
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
