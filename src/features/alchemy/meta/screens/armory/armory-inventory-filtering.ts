import { displayText } from "@/lib/localization/runtime";
import { keywordDefinitions, type KeywordId, type TrinketEntry } from "@/lib/game-data";
import {
  gearDefinitions,
  gearBaseItems,
  getGearInstanceKeywordIds,
  getGearInstanceTitle,
  getGearInstanceTooltipEntries,
  type GearInstance,
  type GearRarity,
} from "@/lib/gear";
import { extractKeywordIds } from "@/lib/keyword-text";

export interface ArmoryInventoryFilters {
  search: string;
  rarities: GearRarity[];
  keywords: KeywordId[];
}

export const DEFAULT_ARMORY_INVENTORY_FILTERS: ArmoryInventoryFilters = {
  search: "",
  rarities: [],
  keywords: [],
};

export function hasArmoryCriteria(filters: ArmoryInventoryFilters, isTrinket: boolean): boolean {
  return Boolean(filters.search.trim()) || filters.keywords.length > 0 || (!isTrinket && filters.rarities.length > 0);
}

function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ");
}

/** One screen/language lifetime; inventory revisions replace immutable item references. */
export function createArmoryInventoryMatcher(translate: typeof displayText = displayText) {
  type Item = GearInstance | TrinketEntry;
  const index = new WeakMap<Item, { text?: string; keywords?: readonly KeywordId[] }>();
  let previousQuery: string | undefined;
  let words: string[] = [];
  function searchWords(query: string): readonly string[] {
    if (query !== previousQuery) {
      previousQuery = query;
      words = normalizeSearch(query).trim().split(/\s+/);
    }
    return words;
  }

  function matches(item: Item, filters: ArmoryInventoryFilters): boolean {
    const gear = "instanceId" in item;
    const definition = gear ? gearDefinitions[item.definitionId] : undefined;
    if (gear && filters.rarities.length > 0 && (!definition || !filters.rarities.includes(definition.rarity)))
      return false;
    if (!filters.search.trim() && filters.keywords.length === 0) return true;

    let cached = index.get(item);
    if (!cached) {
      cached = {};
      index.set(item, cached);
    }
    if (filters.keywords.length > 0) {
      const keywords = (cached.keywords ??= gear
        ? getGearInstanceKeywordIds(item)
        : extractKeywordIds(item.descriptionLines.join(" ")));
      if (!filters.keywords.some((keyword) => keywords.includes(keyword))) return false;
    }
    if (!filters.search.trim()) return true;
    if (cached.text === undefined) {
      const parts = gear
        ? [
            getGearInstanceTitle(item),
            definition ? gearBaseItems[definition.baseItemId]?.displayName : undefined,
            ...getGearInstanceTooltipEntries(item).flatMap((entry) => [entry.name, entry.text]),
          ].filter((part): part is string => typeof part === "string")
        : [item.title, ...item.descriptionLines];
      cached.text = normalizeSearch([...parts, ...parts.map(translate)].join(" "));
    }
    const text = cached.text;
    return searchWords(filters.search).every((word) => text.includes(word));
  }

  return { matches };
}

export const ARMORY_FILTER_KEYWORDS = Object.values(keywordDefinitions)
  .map(({ id, label }) => ({ id, label }))
  .sort((left, right) => left.label.localeCompare(right.label));
