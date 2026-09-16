import { useCallback, useMemo, useState } from "react";
import type { CharacterId, TrinketEntry } from "@/lib/game-data";
import type { ArmorySlot, GearInstance } from "@/lib/gear";
import {
  ARMORY_PAGE_SIZE,
  applyEmptySlotEquip,
  applyHandConflicts,
  applyReplace,
  applyUnequip,
  clampPage,
  defaultGearCompare,
  nameGearCompare,
  reconcileWorkingList,
  trinketCompare,
  type ArmorySortOption,
  type DisplacedGearItem,
} from "./armory-ordering";

interface WorkingCategoryState {
  orderedIds: string[];
  page: number;
}

function categoryStorageKey(characterId: CharacterId, slot: ArmorySlot): string {
  return `${characterId}:${slot}`;
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
  const activeKey = categoryStorageKey(characterId, selectedSlot);

  // Map of categoryKey -> { orderedIds, page }
  const [workingState, setWorkingState] = useState<Record<string, WorkingCategoryState>>({});
  const [placeholderIndex, setPlaceholderIndex] = useState<number | null>(null);

  // Maps for fast item lookup
  const gearById = useMemo(() => new Map(pickerItems.map((item) => [item.instanceId, item])), [pickerItems]);
  const trinketById = useMemo(() => new Map(ownedTrinkets.map((item) => [item.id, item])), [ownedTrinkets]);

  // Compute reconciled ordered IDs for the active category
  const activeState = workingState[activeKey];

  const reconciledIds = useMemo(() => {
    if (isTrinket) {
      const currentIds = activeState?.orderedIds ?? [];
      const pool = ownedTrinkets;
      if (!activeState) {
        return pool
          .slice()
          .sort(trinketCompare)
          .map((t) => t.id);
      }
      return reconcileWorkingList(currentIds, pool, trinketCompare);
    } else {
      const currentIds = activeState?.orderedIds ?? [];
      const pool = pickerItems.map((i) => ({ id: i.instanceId, instance: i }));
      if (!activeState) {
        return pickerItems
          .slice()
          .sort(defaultGearCompare)
          .map((i) => i.instanceId);
      }
      return reconcileWorkingList(currentIds, pool, (a, b) => defaultGearCompare(a.instance, b.instance));
    }
  }, [isTrinket, activeState, ownedTrinkets, pickerItems]);

  // Compute total items and safe clamped page
  const totalItems = reconciledIds.length;
  const rawPage = activeState?.page ?? 0;
  const safePage = clampPage(rawPage, totalItems, ARMORY_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(totalItems / ARMORY_PAGE_SIZE));

  // Turn reconciled IDs into actual items
  const orderedGear = useMemo(() => {
    if (isTrinket) return [];
    return reconciledIds.map((id) => gearById.get(id)).filter((item): item is GearInstance => Boolean(item));
  }, [isTrinket, reconciledIds, gearById]);

  const orderedTrinkets = useMemo(() => {
    if (!isTrinket) return [];
    return reconciledIds.map((id) => trinketById.get(id)).filter((item): item is TrinketEntry => Boolean(item));
  }, [isTrinket, reconciledIds, trinketById]);

  // Sliced page items
  const pageStart = safePage * ARMORY_PAGE_SIZE;
  const pageEnd = pageStart + ARMORY_PAGE_SIZE;
  const pagedGear = useMemo(() => orderedGear.slice(pageStart, pageEnd), [orderedGear, pageStart, pageEnd]);
  const pagedTrinkets = useMemo(() => orderedTrinkets.slice(pageStart, pageEnd), [orderedTrinkets, pageStart, pageEnd]);

  const fillerCount = isTrinket
    ? Math.max(0, ARMORY_PAGE_SIZE - pagedTrinkets.length)
    : Math.max(0, ARMORY_PAGE_SIZE - pagedGear.length);

  // Active placeholder on the current page (if any)
  const placeholderLocalIndex = useMemo(() => {
    if (placeholderIndex === null) return null;
    const placeholderPage = Math.floor(placeholderIndex / ARMORY_PAGE_SIZE);
    if (placeholderPage !== safePage) return null;
    return placeholderIndex % ARMORY_PAGE_SIZE;
  }, [placeholderIndex, safePage]);

  // Page change
  const setPage = useCallback(
    (nextPage: number) => {
      setPlaceholderIndex(null);
      setWorkingState((prev) => {
        const current = prev[activeKey] ?? { orderedIds: reconciledIds, page: 0 };
        return {
          ...prev,
          [activeKey]: {
            ...current,
            page: clampPage(nextPage, reconciledIds.length, ARMORY_PAGE_SIZE),
          },
        };
      });
    },
    [activeKey, reconciledIds],
  );

  // Explicit one-time sort
  const onSort = useCallback(
    (option: ArmorySortOption) => {
      setPlaceholderIndex(null);
      if (isTrinket) {
        const sorted = ownedTrinkets
          .slice()
          .sort(trinketCompare)
          .map((t) => t.id);
        setWorkingState((prev) => ({
          ...prev,
          [activeKey]: { orderedIds: sorted, page: 0 },
        }));
      } else {
        const compareFn = option === "name" ? nameGearCompare : defaultGearCompare;
        const sorted = pickerItems
          .slice()
          .sort(compareFn)
          .map((i) => i.instanceId);
        setWorkingState((prev) => ({
          ...prev,
          [activeKey]: { orderedIds: sorted, page: 0 },
        }));
      }
    },
    [activeKey, isTrinket, ownedTrinkets, pickerItems],
  );

  // Confirmed equipment mutations
  const commitReplacement = useCallback(
    (incomingId: string, replacedId: string) => {
      setPlaceholderIndex(null);
      const nextIds = applyReplace(reconciledIds, incomingId, replacedId);
      setWorkingState((prev) => ({
        ...prev,
        [activeKey]: {
          orderedIds: nextIds,
          page: clampPage(safePage, nextIds.length, ARMORY_PAGE_SIZE),
        },
      }));
    },
    [activeKey, reconciledIds, safePage],
  );

  const commitEmptySlotEquip = useCallback(
    (incomingId: string) => {
      const incomingIndex = reconciledIds.indexOf(incomingId);
      if (incomingIndex !== -1) {
        setPlaceholderIndex(incomingIndex);
      }
      const nextIds = applyEmptySlotEquip(reconciledIds, incomingId);
      setWorkingState((prev) => ({
        ...prev,
        [activeKey]: {
          orderedIds: nextIds,
          page: clampPage(safePage, nextIds.length, ARMORY_PAGE_SIZE),
        },
      }));
    },
    [activeKey, reconciledIds, safePage],
  );

  const commitUnequip = useCallback(
    (unequippedId: string) => {
      setPlaceholderIndex(null);
      const nextIds = applyUnequip(reconciledIds, unequippedId, safePage, ARMORY_PAGE_SIZE);
      setWorkingState((prev) => ({
        ...prev,
        [activeKey]: {
          orderedIds: nextIds,
          page: safePage,
        },
      }));
    },
    [activeKey, reconciledIds, safePage],
  );

  const commitHandConflicts = useCallback(
    (incomingId: string, targetReplacedId: string | null, additionalDisplaced: readonly DisplacedGearItem[]) => {
      setPlaceholderIndex(null);
      const nextIds = applyHandConflicts(
        reconciledIds,
        incomingId,
        targetReplacedId,
        additionalDisplaced,
        selectedSlot,
      );
      setWorkingState((prev) => ({
        ...prev,
        [activeKey]: {
          orderedIds: nextIds,
          page: clampPage(safePage, nextIds.length, ARMORY_PAGE_SIZE),
        },
      }));
    },
    [activeKey, reconciledIds, selectedSlot, safePage],
  );

  const clearPlaceholder = useCallback(() => {
    setPlaceholderIndex((prev) => (prev === null ? prev : null));
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
    commitReplacement,
    commitEmptySlotEquip,
    commitUnequip,
    commitHandConflicts,
  };
}
