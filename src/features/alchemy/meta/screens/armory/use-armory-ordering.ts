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
  availableIds: string[];
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

  // Each visited category keeps its working order until the screen unmounts.
  const [workingState, setWorkingState] = useState<Record<string, WorkingCategoryState>>({});
  const [placeholderIndex, setPlaceholderIndex] = useState<number | null>(null);

  // Maps for fast item lookup
  const gearById = useMemo(() => new Map(pickerItems.map((item) => [item.instanceId, item])), [pickerItems]);
  const trinketById = useMemo(() => new Map(ownedTrinkets.map((item) => [item.id, item])), [ownedTrinkets]);

  const availableById = isTrinket ? trinketById : gearById;
  let activeState = workingState[activeKey];
  if (
    !activeState ||
    activeState.availableIds.length !== availableById.size ||
    activeState.availableIds.some((id) => !availableById.has(id))
  ) {
    const currentIds = activeState?.orderedIds ?? [];
    const orderedIds = isTrinket
      ? reconcileWorkingList(currentIds, ownedTrinkets, trinketCompare)
      : reconcileWorkingList(
          currentIds,
          pickerItems.map((instance) => ({ id: instance.instanceId, instance })),
          (a, b) => defaultGearCompare(a.instance, b.instance),
        );
    activeState = {
      orderedIds,
      availableIds: [...availableById.keys()],
      page: clampPage(activeState?.page ?? 0, orderedIds.length, ARMORY_PAGE_SIZE),
    };
    setWorkingState({ ...workingState, [activeKey]: activeState });
  }

  // Reconcile only new inventory membership. A confirmed transfer can update the
  // working order before refreshed props arrive; the old pool must not undo it.
  const { availableIds, orderedIds: reconciledIds } = activeState;
  const totalItems = reconciledIds.length;
  const safePage = activeState.page;
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

  // Sorting and confirmed transfers preserve the last observed inventory pool.
  const commitIds = useCallback(
    (nextIds: string[], page: number) => {
      setWorkingState((prev) => ({
        ...prev,
        [activeKey]: { availableIds, orderedIds: nextIds, page },
      }));
    },
    [activeKey, availableIds],
  );

  // Page change
  const setPage = useCallback(
    (nextPage: number) => {
      setPlaceholderIndex(null);
      commitIds(reconciledIds, clampPage(nextPage, reconciledIds.length, ARMORY_PAGE_SIZE));
    },
    [commitIds, reconciledIds],
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
        commitIds(sorted, 0);
      } else {
        const compareFn = option === "name" ? nameGearCompare : defaultGearCompare;
        const sorted = pickerItems
          .slice()
          .sort(compareFn)
          .map((i) => i.instanceId);
        commitIds(sorted, 0);
      }
    },
    [commitIds, isTrinket, ownedTrinkets, pickerItems],
  );

  // Confirmed equipment mutations
  const commitEquip = useCallback(
    (incomingId: string, replacedId: string | null, displaced: readonly DisplacedGearItem[] = []) => {
      // Inventory placement is independent of artwork and motion preferences.
      const nextIds =
        displaced.length > 0
          ? applyHandConflicts(reconciledIds, incomingId, replacedId, displaced, selectedSlot)
          : replacedId
            ? applyReplace(reconciledIds, incomingId, replacedId)
            : applyEmptySlotEquip(reconciledIds, incomingId);
      const incomingIndex = reconciledIds.indexOf(incomingId);
      setPlaceholderIndex(!replacedId && displaced.length === 0 && incomingIndex !== -1 ? incomingIndex : null);
      commitIds(nextIds, clampPage(safePage, nextIds.length, ARMORY_PAGE_SIZE));
    },
    [commitIds, reconciledIds, safePage, selectedSlot],
  );

  const commitUnequip = useCallback(
    (unequippedId: string) => {
      setPlaceholderIndex(null);
      const nextIds = applyUnequip(reconciledIds, unequippedId, safePage, ARMORY_PAGE_SIZE);
      commitIds(nextIds, safePage);
    },
    [commitIds, reconciledIds, safePage],
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
    commitEquip,
    commitUnequip,
  };
}
