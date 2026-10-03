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

function matchesSearch(text: string, query: string): boolean {
  const normalized = text.toLocaleLowerCase().replace(/\s+/g, " ");
  return query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .every((word) => normalized.includes(word));
}

function matchesKeywords(keywordIds: readonly KeywordId[], filters: ArmoryInventoryFilters): boolean {
  if (filters.keywords.length === 0) return true;
  return filters.keywords.some((keyword) => keywordIds.includes(keyword));
}

export function matchesGearFilters(item: GearInstance, filters: ArmoryInventoryFilters): boolean {
  const definition = gearDefinitions[item.definitionId];
  if (filters.rarities.length > 0 && (definition?.rarity == null || !filters.rarities.includes(definition.rarity))) {
    return false;
  }
  if (filters.keywords.length > 0 && !matchesKeywords(getGearInstanceKeywordIds(item), filters)) return false;
  if (!filters.search.trim()) return true;

  const searchText = [
    getGearInstanceTitle(item),
    definition ? gearBaseItems[definition.baseItemId]?.displayName : undefined,
    ...getGearInstanceTooltipEntries(item).flatMap((entry) => [entry.name, entry.text]),
  ]
    .filter(Boolean)
    .join(" ");
  return matchesSearch(searchText, filters.search);
}

export function matchesTrinketFilters(item: TrinketEntry, filters: ArmoryInventoryFilters): boolean {
  if (!filters.search.trim() && filters.keywords.length === 0) return true;
  const text = item.descriptionLines.join(" ");
  if (filters.keywords.length > 0 && !matchesKeywords(extractKeywordIds(text), filters)) return false;
  return !filters.search.trim() || matchesSearch(`${item.title} ${text}`, filters.search);
}

export const ARMORY_FILTER_KEYWORDS = Object.values(keywordDefinitions)
  .map(({ id, label }) => ({ id, label }))
  .sort((left, right) => left.label.localeCompare(right.label));
