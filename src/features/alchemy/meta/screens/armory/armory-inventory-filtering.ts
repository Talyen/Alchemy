import { keywordDefinitions, type CharacterId, type KeywordId, type TrinketEntry } from "@/lib/game-data";
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

type ArmoryEquipmentFilter = "equipped" | "unequipped";

export interface ArmoryInventoryFilters {
  search: string;
  rarities: GearRarity[];
  keywords: KeywordId[];
  keywordMatch: "any" | "all";
  equipment: ArmoryEquipmentFilter | null;
}

export const DEFAULT_ARMORY_INVENTORY_FILTERS: ArmoryInventoryFilters = {
  search: "",
  rarities: [],
  keywords: [],
  keywordMatch: "any",
  equipment: null,
};

export function hasArmoryCriteria(filters: ArmoryInventoryFilters, isTrinket: boolean): boolean {
  return (
    Boolean(filters.search.trim()) ||
    filters.keywords.length > 0 ||
    filters.equipment !== null ||
    (!isTrinket && filters.rarities.length > 0)
  );
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
  const includes = (keyword: KeywordId) => keywordIds.includes(keyword);
  return filters.keywordMatch === "all" ? filters.keywords.every(includes) : filters.keywords.some(includes);
}

function matchesEquipment(
  isEquipped: boolean,
  filter: ArmoryEquipmentFilter | null,
  isEquippedByOther = isEquipped,
): boolean {
  return filter === null || (filter === "equipped" ? isEquippedByOther : !isEquipped);
}

export function matchesGearFilters(
  item: GearInstance,
  filters: ArmoryInventoryFilters,
  equippedIds: ReadonlySet<string>,
  otherHeroEquippedIds: ReadonlySet<string> = equippedIds,
): boolean {
  if (!hasArmoryCriteria(filters, false)) return true;
  const definition = gearDefinitions[item.definitionId];
  const searchText = [
    getGearInstanceTitle(item),
    definition ? gearBaseItems[definition.baseItemId]?.displayName : undefined,
    ...getGearInstanceTooltipEntries(item).flatMap((entry) => [entry.name, entry.text]),
  ]
    .filter(Boolean)
    .join(" ");
  return (
    matchesSearch(searchText, filters.search) &&
    (filters.rarities.length === 0 || (definition?.rarity != null && filters.rarities.includes(definition.rarity))) &&
    matchesKeywords(getGearInstanceKeywordIds(item), filters) &&
    matchesEquipment(equippedIds.has(item.instanceId), filters.equipment, otherHeroEquippedIds.has(item.instanceId))
  );
}

export function matchesTrinketFilters(
  item: TrinketEntry,
  filters: ArmoryInventoryFilters,
  equippedIds: ReadonlySet<string>,
): boolean {
  if (!hasArmoryCriteria(filters, true)) return true;
  const text = item.descriptionLines.join(" ");
  return (
    matchesSearch(`${item.title} ${text}`, filters.search) &&
    matchesKeywords(extractKeywordIds(text), filters) &&
    matchesEquipment(equippedIds.has(item.id), filters.equipment)
  );
}

export function getArmoryEquippedGearIds(
  loadouts: Partial<Record<CharacterId, Record<string, string | null>>>,
  excludeCharacterId?: CharacterId,
): Set<string> {
  return new Set(
    Object.entries(loadouts)
      .filter(([id]) => id !== excludeCharacterId)
      .flatMap(([, loadout]) => Object.values(loadout ?? {}).filter((id): id is string => Boolean(id))),
  );
}

export function getArmoryEquippedTrinketIds(
  equippedTrinkets: Partial<Record<CharacterId, string | null>>,
): Set<string> {
  return new Set(Object.values(equippedTrinkets).filter((id): id is string => id != null));
}

export const ARMORY_FILTER_KEYWORDS = Object.values(keywordDefinitions)
  .map(({ id, label }) => ({ id, label }))
  .sort((left, right) => left.label.localeCompare(right.label));
