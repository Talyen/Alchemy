import { displayText, localization } from "@/lib/localization/runtime";
import type { TrinketEntry } from "@/lib/game-data";
import {
  GEAR_SLOTS,
  gearDefinitions,
  gearBaseItems,
  getGearInstanceTitle,
  type ArmorySlot,
  type GearInstance,
  type GearRarity,
  type GearSlot,
} from "@/lib/gear";

export const ARMORY_PAGE_SIZE = 6;

export type ArmorySortOption = "rarity" | "name" | "base-type";

const RARITY_RANK: Record<GearRarity, number> = {
  unique: 0,
  astral: 1,
  basic: 2,
};

/** Sortable row unifying the gear and trinket pipelines: trinkets always rank 0. */
export interface ArmoryOrderRow {
  id: string;
  title: string;
  rank: number;
  baseType: string;
}

export function gearOrderRow(instance: GearInstance): ArmoryOrderRow {
  const definition = gearDefinitions[instance.definitionId];
  return {
    id: instance.instanceId,
    title: getGearInstanceTitle(instance),
    rank: definition?.rarity ? RARITY_RANK[definition.rarity] : 3,
    baseType: definition ? (gearBaseItems[definition.baseItemId]?.displayName ?? "") : "",
  };
}

export function trinketOrderRow(entry: TrinketEntry): ArmoryOrderRow {
  return { id: entry.id, title: entry.title, rank: 0, baseType: "" };
}

export function compareOrderRows(a: ArmoryOrderRow, b: ArmoryOrderRow, sort: ArmorySortOption): number {
  const rankCompare = a.rank - b.rank;
  if (sort === "rarity" && rankCompare !== 0) return rankCompare;
  if (sort === "base-type") {
    const baseCompare = displayText(a.baseType).localeCompare(displayText(b.baseType), localization.language);
    if (baseCompare !== 0) return baseCompare;
  }
  const titleCompare = displayText(a.title).localeCompare(displayText(b.title), localization.language);
  if (titleCompare !== 0) return titleCompare;
  if (rankCompare !== 0) return rankCompare;
  return a.id.localeCompare(b.id);
}

/** Keep surviving ids in manual order; append newly available rows in default order. */
export function reconcileOrder(currentIds: readonly string[], rows: readonly ArmoryOrderRow[]): string[] {
  const available = new Set(rows.map((row) => row.id));
  const surviving = currentIds.filter((id) => available.delete(id));
  const newlyAvailable = rows
    .filter((row) => available.has(row.id))
    .sort((a, b) => compareOrderRows(a, b, "rarity"))
    .flatMap((row) => (available.delete(row.id) ? [row.id] : []));
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

  // Replace the incoming position once with every item returned to inventory.
  // A missing incoming id appends its replacement and other displaced items.
  const returnedIds = [...(targetReplacedId ? [targetReplacedId] : []), ...additionalIds];
  list.splice(incomingIndex === -1 ? list.length : incomingIndex, incomingIndex === -1 ? 0 : 1, ...returnedIds);

  return list;
}

export function placeUnequip(
  currentIds: readonly string[],
  unequippedId: string,
  page: number,
  pageSize: number = ARMORY_PAGE_SIZE,
  visibleIds: readonly string[] = currentIds,
): string[] {
  const filtered = currentIds.filter((id) => id !== unequippedId);
  const visible = visibleIds === currentIds ? filtered : visibleIds.filter((id) => id !== unequippedId);
  const anchor = visible[Math.max(0, page) * pageSize];
  const insertIndex = anchor === undefined ? 0 : Math.max(0, filtered.indexOf(anchor));
  return [...filtered.slice(0, insertIndex), unequippedId, ...filtered.slice(insertIndex)];
}
