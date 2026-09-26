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

const NO_IDS: readonly string[] = [];

interface StoredCategory {
  order: string[];
  poolIds: string[];
  page: number;
}

function reconcileCategory(
  entry: StoredCategory | undefined,
  pool: readonly ArmoryOrderRow[],
  poolIds: readonly string[],
  poolSet: ReadonlySet<string>,
): StoredCategory {
  // Reconcile only on membership change: a confirmed transfer updates the
  // working order before refreshed props arrive, and the old pool must not
  // undo it. Same render-phase adjustment pattern as usePagination.
  if (entry && entry.poolIds.length === poolIds.length && entry.poolIds.every((id) => poolSet.has(id))) return entry;
  const order = reconcileOrder(entry?.order ?? NO_IDS, pool);
  return {
    order,
    poolIds: [...poolIds],
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

  // Maps for fast item lookup
  const gearById = useMemo(() => new Map(pickerItems.map((item) => [item.instanceId, item])), [pickerItems]);
  const trinketById = useMemo(() => new Map(ownedTrinkets.map((item) => [item.id, item])), [ownedTrinkets]);

  const pool: readonly ArmoryOrderRow[] = useMemo(
    () => (isTrinket ? ownedTrinkets.map(trinketOrderRow) : pickerItems.map(gearOrderRow)),
    [isTrinket, pickerItems, ownedTrinkets],
  );
  const poolIds = useMemo(() => pool.map((row) => row.id), [pool]);
  const poolSet = useMemo(() => new Set(poolIds), [poolIds]);

  const entry = stored[activeKey];
  const reconciled = reconcileCategory(entry, pool, poolIds, poolSet);
  if (reconciled !== entry) {
    setStored({ ...stored, [activeKey]: reconciled });
  }
  const orderedIds = reconciled.order;
  const storedPage = reconciled.page;

  const { page: safePage, totalPages } = getPagination(orderedIds.length, storedPage, ARMORY_PAGE_SIZE);

  // Turn reconciled IDs into actual items
  const orderedGear = useMemo(() => {
    if (isTrinket) return [];
    return orderedIds.map((id) => gearById.get(id)).filter((item): item is GearInstance => Boolean(item));
  }, [isTrinket, orderedIds, gearById]);

  const orderedTrinkets = useMemo(() => {
    if (!isTrinket) return [];
    return orderedIds.map((id) => trinketById.get(id)).filter((item): item is TrinketEntry => Boolean(item));
  }, [isTrinket, orderedIds, trinketById]);

  // Sliced page items
  const pageStart = safePage * ARMORY_PAGE_SIZE;
  const pageEnd = pageStart + ARMORY_PAGE_SIZE;
  const pagedGear = useMemo(() => orderedGear.slice(pageStart, pageEnd), [orderedGear, pageStart, pageEnd]);
  const pagedTrinkets = useMemo(() => orderedTrinkets.slice(pageStart, pageEnd), [orderedTrinkets, pageStart, pageEnd]);

  const fillerCount = Math.max(0, ARMORY_PAGE_SIZE - (isTrinket ? pagedTrinkets.length : pagedGear.length));

  // Active placeholder on the current page (if any)
  const placeholderLocalIndex = useMemo(() => {
    if (placeholderIndex === null) return null;
    const placeholderPage = Math.floor(placeholderIndex / ARMORY_PAGE_SIZE);
    if (placeholderPage !== safePage) return null;
    return placeholderIndex % ARMORY_PAGE_SIZE;
  }, [placeholderIndex, safePage]);

  const commitOrder = useCallback(
    (nextIds: string[], page: number) => {
      setStored((prev) => ({ ...prev, [activeKey]: { order: nextIds, poolIds: [...poolIds], page } }));
    },
    [activeKey, poolIds],
  );

  // Page change
  const setPage = useCallback(
    (nextPage: number) => {
      setPlaceholderIndex(null);
      commitOrder(orderedIds, getPagination(orderedIds.length, nextPage, ARMORY_PAGE_SIZE).page);
    },
    [commitOrder, orderedIds],
  );

  // Explicit one-time sort
  const onSort = useCallback(
    (option: ArmorySortOption) => {
      setPlaceholderIndex(null);
      const sorted = [...pool].sort((a, b) => compareOrderRows(a, b, isTrinket ? "name" : option)).map((row) => row.id);
      commitOrder(sorted, 0);
    },
    [commitOrder, isTrinket, pool],
  );

  // Confirmed equipment mutations
  const commitEquip = useCallback(
    (incomingId: string, replacedId: string | null, displaced: readonly DisplacedGearItem[] = []) => {
      // Inventory placement is independent of artwork and motion preferences.
      const nextIds = placeTransfer(orderedIds, incomingId, replacedId, displaced, selectedSlot);
      const incomingIndex = orderedIds.indexOf(incomingId);
      setPlaceholderIndex(!replacedId && displaced.length === 0 && incomingIndex !== -1 ? incomingIndex : null);
      commitOrder(nextIds, getPagination(nextIds.length, storedPage, ARMORY_PAGE_SIZE).page);
    },
    [commitOrder, orderedIds, storedPage, selectedSlot],
  );

  const commitUnequip = useCallback(
    (unequippedId: string) => {
      setPlaceholderIndex(null);
      const nextIds = placeUnequip(orderedIds, unequippedId, storedPage, ARMORY_PAGE_SIZE);
      commitOrder(nextIds, storedPage);
    },
    [commitOrder, orderedIds, storedPage],
  );

  const clearPlaceholder = useCallback(() => {
    setPlaceholderIndex(null);
  }, []);

  return {
    safePage,
    totalPages,
    fillerCount,
    setPage,
    onSort,
    orderedGear,
    orderedTrinkets,
    pagedGear,
    pagedTrinkets,
    placeholderLocalIndex,
    clearPlaceholder,
    commitEquip,
    commitUnequip,
  };
}
