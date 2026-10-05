import { useCallback, useMemo, useState } from "react";
import type { CharacterId, TrinketEntry } from "@/lib/game-data";
import type { ArmorySlot, GearInstance } from "@/lib/gear";
import { getPagination } from "../../../shared/ui/pagination";
import {
  ARMORY_PAGE_SIZE,
  compareOrderRows,
  gearOrderRow,
  placeTransfer,
  placeUnequip,
  reconcileOrder,
  trinketOrderRow,
  type ArmoryOrderRow,
  type ArmorySortOption,
  type DisplacedGearItem,
} from "./armory-ordering";

import {
  DEFAULT_ARMORY_INVENTORY_FILTERS,
  hasArmoryCriteria,
  matchesGearFilters,
  matchesTrinketFilters,
  type ArmoryInventoryFilters,
} from "./armory-inventory-filtering";

const NO_IDS: readonly string[] = [];

interface StoredCategory {
  order: string[];
  poolIds: ReadonlySet<string>;
  page: number;
  filters: ArmoryInventoryFilters;
}

function reconcileCategory(
  entry: StoredCategory | undefined,
  pool: readonly ArmoryOrderRow[],
  poolSet: ReadonlySet<string>,
): StoredCategory {
  // Reconcile only on membership change: a confirmed transfer updates the
  // working order before refreshed props arrive, and the old pool must not
  // undo it. Same render-phase adjustment pattern as usePagination.
  if (entry && entry.poolIds.size === poolSet.size && [...entry.poolIds].every((id) => poolSet.has(id))) return entry;
  const order = reconcileOrder(entry?.order ?? NO_IDS, pool);
  return {
    order,
    filters: entry?.filters ?? DEFAULT_ARMORY_INVENTORY_FILTERS,
    poolIds: poolSet,
    page: getPagination(order.length, entry?.page ?? 0, ARMORY_PAGE_SIZE).page,
  };
}

export function useArmoryOrdering({
  characterId,
  selectedSlot,
  pickerItems,
  ownedTrinkets,
}: {
  characterId: CharacterId;
  selectedSlot: ArmorySlot;
  pickerItems: GearInstance[];
  ownedTrinkets: TrinketEntry[];
}) {
  const isTrinket = selectedSlot === "trinket";
  const activeKey = `${characterId}:${selectedSlot}`;

  // Each visited category keeps its working order until the screen unmounts.
  // reconcileCategory derives the visible order (persisted via the
  // render-phase adjustment below); explicit commits persist via commitOrder.
  const [stored, setStored] = useState<Record<string, StoredCategory>>({});
  const [placeholderIndex, setPlaceholderIndex] = useState<number | null>(null);

  const pool = useMemo(
    () =>
      isTrinket
        ? ownedTrinkets.map((item) => ({ ...trinketOrderRow(item), item }))
        : pickerItems.map((item) => ({ ...gearOrderRow(item), item })),
    [isTrinket, pickerItems, ownedTrinkets],
  );
  const byId = useMemo(
    () => new Map<string, GearInstance | TrinketEntry>(pool.map(({ id, item }) => [id, item])),
    [pool],
  );
  const poolSet = useMemo(() => new Set(pool.map((row) => row.id)), [pool]);

  const entry = stored[activeKey];
  const reconciled = reconcileCategory(entry, pool, poolSet);
  const orderedIds = reconciled.order;
  const storedPage = reconciled.page;

  const filters = reconciled.filters;
  const hasCriteria = hasArmoryCriteria(filters, isTrinket);

  // Keep the complete order separate from its current browsing projection.
  // Reconciliation writes the category during render; derive its projection
  // directly so it cannot retain a previous category's items.
  const visibleItems = orderedIds.flatMap((id) => {
    const item = byId.get(id);
    if (!item) return [];
    const matches = "instanceId" in item ? matchesGearFilters(item, filters) : matchesTrinketFilters(item, filters);
    return matches ? [item] : [];
  });
  const visibleGear = visibleItems.filter((item): item is GearInstance => "instanceId" in item);
  const visibleTrinkets = visibleItems.filter((item): item is TrinketEntry => !("instanceId" in item));
  const visibleIds = isTrinket ? visibleTrinkets.map((item) => item.id) : visibleGear.map((item) => item.instanceId);
  const { page: safePage, totalPages } = getPagination(visibleIds.length, storedPage, ARMORY_PAGE_SIZE);
  // Persist clamping so later inventory growth cannot restore an obsolete page.
  if (reconciled !== entry || safePage !== storedPage) {
    setStored({ ...stored, [activeKey]: { ...reconciled, page: safePage } });
  }

  // Sliced page items
  const pageStart = safePage * ARMORY_PAGE_SIZE;
  const pageEnd = pageStart + ARMORY_PAGE_SIZE;
  const pagedGear = visibleGear.slice(pageStart, pageEnd);
  const pagedTrinkets = visibleTrinkets.slice(pageStart, pageEnd);

  const fillerCount = Math.max(0, ARMORY_PAGE_SIZE - (isTrinket ? pagedTrinkets.length : pagedGear.length));

  // Active placeholder on the current page (if any)
  const placeholderLocalIndex =
    placeholderIndex !== null && Math.floor(placeholderIndex / ARMORY_PAGE_SIZE) === safePage
      ? placeholderIndex % ARMORY_PAGE_SIZE
      : null;

  const commitOrder = (nextIds: string[], page: number) => {
    setStored((prev) => ({
      ...prev,
      [activeKey]: {
        order: nextIds,
        poolIds: poolSet,
        page,
        filters: prev[activeKey]?.filters ?? DEFAULT_ARMORY_INVENTORY_FILTERS,
      },
    }));
  };

  // Page change
  const setPage = (nextPage: number) => {
    setPlaceholderIndex(null);
    commitOrder(orderedIds, getPagination(visibleIds.length, nextPage, ARMORY_PAGE_SIZE).page);
  };

  // Explicit one-time sort
  const onSort = (option: ArmorySortOption) => {
    setPlaceholderIndex(null);
    const sorted = new Set(
      [...pool]
        .sort((a, b) => compareOrderRows(a, b, isTrinket && option === "rarity" ? "name" : option))
        .map((row) => row.id),
    );
    commitOrder([...sorted], 0);
  };

  // Confirmed equipment mutations
  const commitEquip = (incomingId: string, replacedId: string | null, displaced: readonly DisplacedGearItem[] = []) => {
    // Inventory placement is independent of artwork and motion preferences.
    const nextIds = placeTransfer(orderedIds, incomingId, replacedId, displaced, selectedSlot);
    const incomingIndex = visibleIds.indexOf(incomingId);
    setPlaceholderIndex(
      !hasCriteria && !replacedId && displaced.length === 0 && incomingIndex !== -1 ? incomingIndex : null,
    );
    commitOrder(nextIds, getPagination(nextIds.length, storedPage, ARMORY_PAGE_SIZE).page);
  };

  const commitUnequip = (unequippedId: string) => {
    setPlaceholderIndex(null);
    const nextIds = placeUnequip(orderedIds, unequippedId, safePage, ARMORY_PAGE_SIZE, visibleIds);
    commitOrder(nextIds, safePage);
  };

  const clearPlaceholder = useCallback(() => {
    setPlaceholderIndex(null);
  }, []);

  const setFilters = (nextFilters: ArmoryInventoryFilters) => {
    setPlaceholderIndex(null);
    setStored((prev) => ({
      ...prev,
      [activeKey]: { ...(prev[activeKey] ?? reconciled), filters: nextFilters, page: 0 },
    }));
  };

  return {
    filters,
    setFilters,
    hasCriteria,
    visibleGear,
    visibleTrinkets,
    matchCount: visibleIds.length,
    totalCount: pool.length,
    safePage,
    totalPages,
    fillerCount,
    setPage,
    onSort,
    pagedGear,
    pagedTrinkets,
    placeholderLocalIndex,
    clearPlaceholder,
    commitEquip,
    commitUnequip,
  };
}
