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

function matchesSearch(text: string, words: readonly string[]): boolean {
  return words.every((word) => text.includes(word));
}

function matchesKeywords(keywordIds: readonly KeywordId[], filters: ArmoryInventoryFilters): boolean {
  if (filters.keywords.length === 0) return true;
  return filters.keywords.some((keyword) => keywordIds.includes(keyword));
}

/** One screen/language lifetime; inventory revisions replace immutable item references. */
export function createArmoryInventoryMatcher(translate: typeof displayText = displayText) {
  const gearText = new WeakMap<GearInstance, string>();
  const trinketText = new WeakMap<TrinketEntry, string>();
  const gearKeywords = new WeakMap<GearInstance, readonly KeywordId[]>();
  const trinketKeywords = new WeakMap<TrinketEntry, KeywordId[]>();
  let previousQuery: string | undefined;
  let words: string[] = [];
  function searchWords(query: string): readonly string[] {
    if (query !== previousQuery) {
      previousQuery = query;
      words = normalizeSearch(query).trim().split(/\s+/);
    }
    return words;
  }

  return {
    matchesGearFilters(item: GearInstance, filters: ArmoryInventoryFilters): boolean {
      const definition = gearDefinitions[item.definitionId];
      if (filters.rarities.length > 0 && (definition?.rarity == null || !filters.rarities.includes(definition.rarity)))
        return false;
      if (filters.keywords.length > 0) {
        let keywords = gearKeywords.get(item);
        if (!keywords) {
          keywords = getGearInstanceKeywordIds(item);
          gearKeywords.set(item, keywords);
        }
        if (!matchesKeywords(keywords, filters)) return false;
      }
      if (!filters.search.trim()) return true;
      let text = gearText.get(item);
      if (text === undefined) {
        const parts = [
          getGearInstanceTitle(item),
          definition ? gearBaseItems[definition.baseItemId]?.displayName : undefined,
          ...getGearInstanceTooltipEntries(item).flatMap((entry) => [entry.name, entry.text]),
        ].filter((part): part is string => typeof part === "string");
        text = normalizeSearch([...parts, ...parts.map(translate)].join(" "));
        gearText.set(item, text);
      }
      return matchesSearch(text, searchWords(filters.search));
    },
    matchesTrinketFilters(item: TrinketEntry, filters: ArmoryInventoryFilters): boolean {
      if (!filters.search.trim() && filters.keywords.length === 0) return true;
      if (filters.keywords.length > 0) {
        let keywords = trinketKeywords.get(item);
        if (!keywords) {
          keywords = extractKeywordIds(item.descriptionLines.join(" "));
          trinketKeywords.set(item, keywords);
        }
        if (!matchesKeywords(keywords, filters)) return false;
      }
      if (!filters.search.trim()) return true;
      let text = trinketText.get(item);
      if (text === undefined) {
        text = normalizeSearch(
          [
            item.title,
            item.descriptionLines.join(" "),
            translate(item.title),
            ...item.descriptionLines.map(translate),
          ].join(" "),
        );
        trinketText.set(item, text);
      }
      return matchesSearch(text, searchWords(filters.search));
    },
  };
}

export const ARMORY_FILTER_KEYWORDS = Object.values(keywordDefinitions)
  .map(({ id, label }) => ({ id, label }))
  .sort((left, right) => left.label.localeCompare(right.label));
