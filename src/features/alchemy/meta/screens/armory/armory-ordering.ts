import type { TrinketEntry } from "@/lib/game-data";
import {
  GEAR_SLOTS,
  gearDefinitions,
  getGearInstanceTitle,
  type ArmorySlot,
  type GearInstance,
  type GearRarity,
  type GearSlot,
} from "@/lib/gear";

export const ARMORY_PAGE_SIZE = 6;

type GearSortOption = "rarity" | "name";
type TrinketSortOption = "name";
export type ArmorySortOption = GearSortOption | TrinketSortOption;

const RARITY_RANK: Record<GearRarity, number> = {
  unique: 0,
  astral: 1,
  basic: 2,
};

function getGearRarityRank(instance: GearInstance): number {
  const rarity = gearDefinitions[instance.definitionId]?.rarity;
  return rarity ? RARITY_RANK[rarity] : 3;
}

export function defaultGearCompare(a: GearInstance, b: GearInstance): number {
  const rankA = getGearRarityRank(a);
  const rankB = getGearRarityRank(b);
  if (rankA !== rankB) return rankA - rankB;

  const titleA = getGearInstanceTitle(a);
  const titleB = getGearInstanceTitle(b);
  const titleCompare = titleA.localeCompare(titleB);
  if (titleCompare !== 0) return titleCompare;

  return a.instanceId.localeCompare(b.instanceId);
}

export function nameGearCompare(a: GearInstance, b: GearInstance): number {
  const titleA = getGearInstanceTitle(a);
  const titleB = getGearInstanceTitle(b);
  const titleCompare = titleA.localeCompare(titleB);
  if (titleCompare !== 0) return titleCompare;

  const rankA = getGearRarityRank(a);
  const rankB = getGearRarityRank(b);
  if (rankA !== rankB) return rankA - rankB;

  return a.instanceId.localeCompare(b.instanceId);
}

export function trinketCompare(a: TrinketEntry, b: TrinketEntry): number {
  const titleCompare = a.title.localeCompare(b.title);
  if (titleCompare !== 0) return titleCompare;

  return a.id.localeCompare(b.id);
}

export function clampPage(page: number, totalCount: number, pageSize: number = ARMORY_PAGE_SIZE): number {
  if (totalCount <= 0) return 0;
  const maxPage = Math.max(0, Math.ceil(totalCount / pageSize) - 1);
  return Math.max(0, Math.min(page, maxPage));
}

export function reconcileWorkingList<T extends { id: string }>(
  currentIds: readonly string[],
  availablePool: readonly T[],
  defaultCompare: (a: T, b: T) => number,
): string[] {
  const availableMap = new Map<string, T>(availablePool.map((item) => [item.id, item]));
  const surviving = currentIds.filter((id) => availableMap.has(id));
  const survivingSet = new Set(surviving);

  const newlyAvailable = availablePool
    .filter((item) => !survivingSet.has(item.id))
    .slice()
    .sort(defaultCompare)
    .map((item) => item.id);

  return [...surviving, ...newlyAvailable];
}

export function applyReplace(currentIds: readonly string[], incomingId: string, replacedId: string): string[] {
  const index = currentIds.indexOf(incomingId);
  if (index === -1) {
    return [...currentIds.filter((id) => id !== incomingId), replacedId];
  }
  const next = currentIds.slice();
  next[index] = replacedId;
  return next;
}

export function applyEmptySlotEquip(currentIds: readonly string[], incomingId: string): string[] {
  return currentIds.filter((id) => id !== incomingId);
}

export function applyUnequip(
  currentIds: readonly string[],
  unequippedId: string,
  page: number,
  pageSize: number = ARMORY_PAGE_SIZE,
): string[] {
  const filtered = currentIds.filter((id) => id !== unequippedId);
  const insertIndex = Math.max(0, Math.min(page * pageSize, filtered.length));
  return [...filtered.slice(0, insertIndex), unequippedId, ...filtered.slice(insertIndex)];
}

export interface DisplacedGearItem {
  slot: GearSlot;
  instance: GearInstance;
}

export function applyHandConflicts(
  currentIds: readonly string[],
  incomingId: string,
  targetReplacedId: string | null,
  additionalDisplaced: readonly DisplacedGearItem[],
  currentSlot: ArmorySlot,
): string[] {
  const compatibleAdditional = additionalDisplaced
    .slice()
    .sort((a, b) => GEAR_SLOTS.indexOf(a.slot) - GEAR_SLOTS.indexOf(b.slot))
    .filter((d) => {
      const def = gearDefinitions[d.instance.definitionId];
      return currentSlot !== "trinket" && (def?.compatibleSlots.includes(currentSlot) ?? false);
    });

  const additionalIds = compatibleAdditional.map((d) => d.instance.instanceId);
  // Displaced hand items may already be visible in this category. Remove them
  // before locating the incoming item so their old positions cannot skew insertion.
  let list = currentIds.filter((id) => !additionalIds.includes(id));
  const incomingIndex = list.indexOf(incomingId);

  // 1. Target slot replacement or removal
  if (targetReplacedId) {
    if (incomingIndex !== -1) {
      list[incomingIndex] = targetReplacedId;
    } else {
      list.push(targetReplacedId);
    }
  } else {
    list = list.filter((id) => id !== incomingId);
  }

  if (compatibleAdditional.length > 0) {
    const anchorIndex = targetReplacedId ? list.indexOf(targetReplacedId) : incomingIndex;
    const insertPosition = targetReplacedId
      ? anchorIndex !== -1
        ? anchorIndex + 1
        : list.length
      : anchorIndex !== -1
        ? Math.min(anchorIndex, list.length)
        : list.length;
    list.splice(insertPosition, 0, ...additionalIds);
  }

  return list;
}
