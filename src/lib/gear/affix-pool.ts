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

function createEligibleAffixPool(definition: GearDefinition, excludedIds?: ReadonlySet<string>): GearAffixDefinition[] {
  const aspect = requiredAspect(definition);
  return gearAffixList.filter(
    (affix) =>
      !affix.uniqueOnly &&
      !excludedIds?.has(affix.id) &&
      (aspect === null || affix.aspect === aspect) &&
      affixMatchesAffinity(affix, definition.affinityKeywords),
  );
}

export function buildEligibleAffixPool(
  definition: GearDefinition,
  excludedIds?: ReadonlySet<string>,
): readonly GearAffixDefinition[] {
  return createEligibleAffixPool(definition, excludedIds);
}

export function rollAffixes(definition: GearDefinition, count: number, rng: () => number): GearAffixRoll[] {
  if (count === 0) return [];

  const remaining = createEligibleAffixPool(definition);
  const effectiveCount = Math.min(count, remaining.length);
  const selected: GearAffixRoll[] = [];
  const rarity = definition.rarity;

  for (let pick = 0; pick < effectiveCount; pick += 1) {
    const chosen = takeRandomItem(remaining, rng);
    if (!chosen) break;
    selected.push({ id: chosen.id, value: rollAffixValue(chosen, rarity, rng) });
  }

  return selected;
}
