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

export type ArmorySortOption = "rarity" | "name";

const RARITY_RANK: Record<GearRarity, number> = {
  unique: 0,
  astral: 1,
  basic: 2,
};

function getGearRarityRank(instance: GearInstance): number {
  const rarity = gearDefinitions[instance.definitionId]?.rarity;
  return rarity ? RARITY_RANK[rarity] : 3;
}

/** Sortable row unifying the gear and trinket pipelines: trinkets always rank 0. */
export interface ArmoryOrderRow {
  id: string;
  title: string;
  rank: number;
}

export function gearOrderRow(instance: GearInstance): ArmoryOrderRow {
  return { id: instance.instanceId, title: getGearInstanceTitle(instance), rank: getGearRarityRank(instance) };
}

export function trinketOrderRow(entry: TrinketEntry): ArmoryOrderRow {
  return { id: entry.id, title: entry.title, rank: 0 };
}

export function compareOrderRows(a: ArmoryOrderRow, b: ArmoryOrderRow, sort: ArmorySortOption): number {
  const rankCompare = a.rank - b.rank;
  const titleCompare = a.title.localeCompare(b.title);
  if (sort === "name") {
    if (titleCompare !== 0) return titleCompare;
    if (rankCompare !== 0) return rankCompare;
  } else {
    if (rankCompare !== 0) return rankCompare;
    if (titleCompare !== 0) return titleCompare;
  }
  return a.id.localeCompare(b.id);
}

/** Keep surviving ids in manual order; append newly available rows in default order. */
export function reconcileOrder(currentIds: readonly string[], rows: readonly ArmoryOrderRow[]): string[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const surviving = currentIds.filter((id) => byId.has(id));
  const survivingSet = new Set(surviving);
  const newlyAvailable = rows
    .filter((row) => !survivingSet.has(row.id))
    .slice()
    .sort((a, b) => compareOrderRows(a, b, "rarity"))
    .map((row) => row.id);
  return [...surviving, ...newlyAvailable];
}

export interface DisplacedGearItem {
  slot: GearSlot;
  instance: GearInstance;
}

/**
 * Single transfer placement. Replacing the incoming slot (or pushing the
 * displaced target) and removing an equipped-away id are the same operation;
 * the empty-displaced case is exactly the old replace/remove specializations.
 */
export function placeTransfer(
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
  const list = currentIds.filter((id) => !additionalIds.includes(id));
  const incomingIndex = list.indexOf(incomingId);

  // 1. Target slot replacement or removal
  if (targetReplacedId) {
    if (incomingIndex !== -1) list[incomingIndex] = targetReplacedId;
    else list.push(targetReplacedId);
  } else {
    const removalIndex = list.indexOf(incomingId);
    if (removalIndex !== -1) list.splice(removalIndex, 1);
  }

  if (compatibleAdditional.length > 0) {
    const anchorIndex = targetReplacedId ? list.indexOf(targetReplacedId) : incomingIndex;
    const insertPosition = anchorIndex === -1 ? list.length : targetReplacedId ? anchorIndex + 1 : anchorIndex;
    list.splice(insertPosition, 0, ...additionalIds);
  }

  return list;
}

export function placeUnequip(
  currentIds: readonly string[],
  unequippedId: string,
  page: number,
  pageSize: number = ARMORY_PAGE_SIZE,
): string[] {
  const filtered = currentIds.filter((id) => id !== unequippedId);
  const insertIndex = Math.max(0, Math.min(page * pageSize, filtered.length));
  return [...filtered.slice(0, insertIndex), unequippedId, ...filtered.slice(insertIndex)];
}
