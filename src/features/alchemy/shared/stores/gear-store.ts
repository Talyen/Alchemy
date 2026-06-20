import { create } from "zustand";
import type { CharacterId } from "@/lib/game-data";
import {
  createEmptyGearInventories,
  createEmptyGearBoardPositionsByCharacter,
  createEmptyGearLoadouts,
  createEmptyCurrencyBoardPositionsByCharacter,
  equipGear,
  flattenGearInventories,
  findGearInventoryOwner,
  salvageGear,
  unequipGear,
  type GearBoardPositions,
  type GearBoardPositionsByCharacter,
  type GearInstance,
  type GearInventories,
  type GearLoadouts,
  type GearSlot,
  type CraftingCurrencyId,
  type CraftingCurrencyBoardPositions,
  type CraftingCurrencyBoardPositionsByCharacter,
  canApplyCraftingCurrency,
  applyCraftingCurrency,
  EMPTY_CRAFTING_CURRENCIES,
  addCraftingCurrencies,
  normalizeCraftingCurrencies,
  sanitizeGearBoardPositionsByCharacter,
  sanitizeCurrencyBoardPositionsByCharacter,
  footprintForInstance,
  CRAFTING_CURRENCY_IDS,
  INVENTORY_COLS,
  GEAR_CHARACTER_IDS,
  GEAR_SLOTS,
  resolveMoveWithSwap,
  packMixedBoard,
} from "@/lib/gear";

type BoardEntry =
  | {
      id: string;
      kind: "gear";
      item: GearInstance;
      footprint: { w: number; h: number };
      saved?: { col: number; row: number };
    }
  | {
      id: CraftingCurrencyId;
      kind: "currency";
      item: CraftingCurrencyId;
      footprint: { w: 1; h: 1 };
      saved?: { col: number; row: number };
    };

type BoardItemRef = { kind: "gear"; id: string } | { kind: "currency"; id: CraftingCurrencyId };

type BoardSourceState = {
  inventories: GearInventories;
  loadouts: GearLoadouts;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  boardPositionsByCharacter: GearBoardPositionsByCharacter;
  currencyBoardPositionsByCharacter: CraftingCurrencyBoardPositionsByCharacter;
};

function buildBoardEntriesForCharacter(state: BoardSourceState, characterId: CharacterId): BoardEntry[] {
  const equippedInstanceIds = new Set(Object.values(state.loadouts[characterId] ?? {}).filter(Boolean) as string[]);
  const availableInventory = (state.inventories[characterId] ?? []).filter(
    (item) => !equippedInstanceIds.has(item.instanceId),
  );
  const activeCurrencies = CRAFTING_CURRENCY_IDS.filter((id) => (state.craftingCurrencies[id] ?? 0) > 0);
  const gearPositions = state.boardPositionsByCharacter[characterId] ?? {};
  const currencyPositions = state.currencyBoardPositionsByCharacter[characterId] ?? {};

  const entries: BoardEntry[] = [];

  for (const item of availableInventory) {
    const footprint = footprintForInstance(item);
    if (!footprint) continue;
    const saved = gearPositions[item.instanceId];
    if (saved) {
      entries.push({ id: item.instanceId, kind: "gear", item, footprint, saved });
    } else {
      entries.push({ id: item.instanceId, kind: "gear", item, footprint });
    }
  }

  for (const currencyId of activeCurrencies) {
    const saved = currencyPositions[currencyId];
    if (saved) {
      entries.push({ id: currencyId, kind: "currency", item: currencyId, footprint: { w: 1, h: 1 }, saved });
    } else {
      entries.push({ id: currencyId, kind: "currency", item: currencyId, footprint: { w: 1, h: 1 } });
    }
  }

  return entries;
}

function resolveMoveItemAndSwap(
  characterId: CharacterId,
  movingItem: BoardItemRef,
  targetCol: number,
  targetRow: number,
  state: GearStore,
): {
  nextGearPositions: GearBoardPositions;
  nextCurrencyPositions: CraftingCurrencyBoardPositions;
} {
  const nextGearPositions: GearBoardPositions = {
    ...(state.boardPositionsByCharacter[characterId] ?? {}),
  };
  const nextCurrencyPositions: CraftingCurrencyBoardPositions = {
    ...(state.currencyBoardPositionsByCharacter[characterId] ?? {}),
  };

  const boardItems = buildBoardEntriesForCharacter(state, characterId).map((entry) => ({
    id: entry.id,
    kind: entry.kind,
    footprint: entry.footprint,
    position: entry.saved ?? { col: 1, row: 1 },
  }));

  if (!boardItems.some((item) => item.id === movingItem.id && item.kind === movingItem.kind)) {
    return { nextGearPositions, nextCurrencyPositions };
  }

  const { positions, unchanged } = resolveMoveWithSwap(
    boardItems,
    movingItem.id,
    { col: targetCol, row: targetRow },
    INVENTORY_COLS,
  );
  if (unchanged) return { nextGearPositions, nextCurrencyPositions };

  for (const item of boardItems) {
    const next = positions.get(item.id);
    if (!next) continue;
    if (item.kind === "gear") {
      nextGearPositions[item.id] = next;
    } else {
      nextCurrencyPositions[item.id as CraftingCurrencyId] = next;
    }
  }
  return { nextGearPositions, nextCurrencyPositions };
}

function moveBoardItemForState(
  state: GearStore,
  characterId: CharacterId,
  item: BoardItemRef,
  col: number,
  row: number,
) {
  const { nextGearPositions, nextCurrencyPositions } = resolveMoveItemAndSwap(characterId, item, col, row, state);
  const nextState = {
    boardPositionsByCharacter: {
      ...state.boardPositionsByCharacter,
      [characterId]: nextGearPositions,
    },
    currencyBoardPositionsByCharacter: {
      ...state.currencyBoardPositionsByCharacter,
      [characterId]: nextCurrencyPositions,
    },
  };
  return {
    ...nextState,
    ...syncBoardPositionsForState({
      ...state,
      ...nextState,
    }),
  };
}

type GearStore = {
  inventories: GearInventories;
  loadouts: GearLoadouts;
  boardPositionsByCharacter: GearBoardPositionsByCharacter;
  equippedReturnPositions: GearBoardPositions;
  currencyBoardPositionsByCharacter: CraftingCurrencyBoardPositionsByCharacter;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  initialize: (
    inventories: GearInventories,
    loadouts: GearLoadouts,
    boardPositionsByCharacter?: GearBoardPositionsByCharacter,
    craftingCurrencies?: Partial<Record<CraftingCurrencyId, number>>,
    equippedReturnPositions?: GearBoardPositions,
    currencyBoardPositionsByCharacter?: CraftingCurrencyBoardPositionsByCharacter,
  ) => void;
  addInstance: (instance: GearInstance, characterId: CharacterId) => void;
  transferToInventory: (instanceId: string, targetCharacterId: CharacterId) => boolean;
  equip: (
    characterId: CharacterId,
    slot: GearSlot,
    instance: GearInstance,
    options?: { vacatedPlacement?: { col: number; row: number }; swapDisplaced?: boolean },
  ) => void;
  unequip: (characterId: CharacterId, slot: GearSlot) => void;
  moveBoardItem: (characterId: CharacterId, item: BoardItemRef, col: number, row: number) => void;
  syncBoardPositions: () => void;
  salvage: (
    instanceId: string,
    options?: { rng?: () => number },
  ) => { inventories: GearInventories; yieldedCurrencies: Record<CraftingCurrencyId, number> } | null;
  applyCurrency: (currencyId: CraftingCurrencyId, instanceId: string, options?: { rng?: () => number }) => boolean;
  addCurrencies: (currencies: Partial<Record<CraftingCurrencyId, number>>) => void;
  reset: () => void;
};

const initialState = {
  inventories: createEmptyGearInventories(),
  loadouts: createEmptyGearLoadouts(),
  boardPositionsByCharacter: createEmptyGearBoardPositionsByCharacter(),
  equippedReturnPositions: {} as GearBoardPositions,
  currencyBoardPositionsByCharacter: createEmptyCurrencyBoardPositionsByCharacter(),
  craftingCurrencies: { ...EMPTY_CRAFTING_CURRENCIES },
};

function boardPositionsEqual(left: GearBoardPositions, right: GearBoardPositions): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((instanceId) => {
    const leftPosition = left[instanceId];
    const rightPosition = right[instanceId];
    return (
      leftPosition !== undefined &&
      rightPosition !== undefined &&
      leftPosition.col === rightPosition.col &&
      leftPosition.row === rightPosition.row
    );
  });
}

function currencyBoardPositionsEqual(
  left: CraftingCurrencyBoardPositions,
  right: CraftingCurrencyBoardPositions,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((currencyId) => {
    const leftPosition = left[currencyId as CraftingCurrencyId];
    const rightPosition = right[currencyId as CraftingCurrencyId];
    return (
      leftPosition !== undefined &&
      rightPosition !== undefined &&
      leftPosition.col === rightPosition.col &&
      leftPosition.row === rightPosition.row
    );
  });
}

function boardPositionsByCharacterEqual(
  left: GearBoardPositionsByCharacter,
  right: GearBoardPositionsByCharacter,
): boolean {
  return Object.keys(left).every((characterId) =>
    boardPositionsEqual(left[characterId as CharacterId] ?? {}, right[characterId as CharacterId] ?? {}),
  );
}

function currencyBoardPositionsByCharacterEqual(
  left: CraftingCurrencyBoardPositionsByCharacter,
  right: CraftingCurrencyBoardPositionsByCharacter,
): boolean {
  return Object.keys(left).every((characterId) =>
    currencyBoardPositionsEqual(left[characterId as CharacterId] ?? {}, right[characterId as CharacterId] ?? {}),
  );
}

function syncBoardPositionsForState(state: {
  inventories: GearInventories;
  loadouts: GearLoadouts;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  boardPositionsByCharacter: GearBoardPositionsByCharacter;
  currencyBoardPositionsByCharacter: CraftingCurrencyBoardPositionsByCharacter;
}): {
  boardPositionsByCharacter: GearBoardPositionsByCharacter;
  currencyBoardPositionsByCharacter: CraftingCurrencyBoardPositionsByCharacter;
} {
  let changed = false;
  const nextBoardPositionsByCharacter = { ...state.boardPositionsByCharacter };
  const nextCurrencyPositionsByCharacter = { ...state.currencyBoardPositionsByCharacter };

  for (const characterId of GEAR_CHARACTER_IDS) {
    const gearPositions = { ...(nextBoardPositionsByCharacter[characterId] ?? {}) };
    const currencyPositions = { ...(nextCurrencyPositionsByCharacter[characterId] ?? {}) };
    const mixed = buildBoardEntriesForCharacter(
      {
        ...state,
        boardPositionsByCharacter: nextBoardPositionsByCharacter,
        currencyBoardPositionsByCharacter: nextCurrencyPositionsByCharacter,
      },
      characterId,
    );

    const packed = packMixedBoard<"gear" | "currency", BoardEntry>(
      mixed,
      INVENTORY_COLS,
      (entry) => entry.footprint,
      (entry) => entry.saved,
    );

    const nextGearForChar: GearBoardPositions = { ...gearPositions };
    const nextCurrencyForChar: CraftingCurrencyBoardPositions = {};
    const prevGearKeys = Object.keys(gearPositions).sort();
    const nextGearKeys: string[] = [];
    for (const { item, col, row } of packed) {
      if (item.kind === "gear") {
        nextGearForChar[item.item.instanceId] = { col, row };
        nextGearKeys.push(item.item.instanceId);
      } else {
        nextCurrencyForChar[item.item] = { col, row };
      }
    }
    if (nextGearKeys.join("|") !== prevGearKeys.join("|")) changed = true;
    const prevCurrencyKeys = Object.keys(currencyPositions).sort();
    const nextCurrencyKeys = Object.keys(nextCurrencyForChar).sort();
    if (nextCurrencyKeys.join("|") !== prevCurrencyKeys.join("|")) changed = true;

    nextBoardPositionsByCharacter[characterId] = nextGearForChar;
    nextCurrencyPositionsByCharacter[characterId] = nextCurrencyForChar;
  }

  if (
    !changed &&
    boardPositionsByCharacterEqual(state.boardPositionsByCharacter, nextBoardPositionsByCharacter) &&
    currencyBoardPositionsByCharacterEqual(state.currencyBoardPositionsByCharacter, nextCurrencyPositionsByCharacter)
  ) {
    return {
      boardPositionsByCharacter: state.boardPositionsByCharacter,
      currencyBoardPositionsByCharacter: state.currencyBoardPositionsByCharacter,
    };
  }

  return {
    boardPositionsByCharacter: nextBoardPositionsByCharacter,
    currencyBoardPositionsByCharacter: nextCurrencyPositionsByCharacter,
  };
}

function updateGearStateAndSync(
  state: {
    inventories: GearInventories;
    loadouts: GearLoadouts;
    boardPositionsByCharacter: GearBoardPositionsByCharacter;
    equippedReturnPositions: GearBoardPositions;
    currencyBoardPositionsByCharacter: CraftingCurrencyBoardPositionsByCharacter;
    craftingCurrencies: Record<CraftingCurrencyId, number>;
  },
  updates: Partial<{
    inventories: GearInventories;
    loadouts: GearLoadouts;
    boardPositionsByCharacter: GearBoardPositionsByCharacter;
    equippedReturnPositions: GearBoardPositions;
    currencyBoardPositionsByCharacter: CraftingCurrencyBoardPositionsByCharacter;
    craftingCurrencies: Record<CraftingCurrencyId, number>;
  }>,
) {
  const merged = { ...state, ...updates };
  const sanitizedGear = sanitizeGearBoardPositionsByCharacter(merged.boardPositionsByCharacter, merged.inventories);
  const sanitizedCurrency = sanitizeCurrencyBoardPositionsByCharacter(
    merged.currencyBoardPositionsByCharacter,
    merged.craftingCurrencies,
  );

  const finalGear = boardPositionsByCharacterEqual(state.boardPositionsByCharacter, sanitizedGear)
    ? state.boardPositionsByCharacter
    : sanitizedGear;
  const finalCurrency = currencyBoardPositionsByCharacterEqual(
    state.currencyBoardPositionsByCharacter,
    sanitizedCurrency,
  )
    ? state.currencyBoardPositionsByCharacter
    : sanitizedCurrency;

  const mergedSanitized = {
    ...merged,
    boardPositionsByCharacter: finalGear,
    currencyBoardPositionsByCharacter: finalCurrency,
  };

  const synced = syncBoardPositionsForState(mergedSanitized);

  const finalSyncedGear = boardPositionsByCharacterEqual(
    merged.boardPositionsByCharacter,
    synced.boardPositionsByCharacter,
  )
    ? merged.boardPositionsByCharacter
    : synced.boardPositionsByCharacter;
  const finalSyncedCurrency = currencyBoardPositionsByCharacterEqual(
    merged.currencyBoardPositionsByCharacter,
    synced.currencyBoardPositionsByCharacter,
  )
    ? merged.currencyBoardPositionsByCharacter
    : synced.currencyBoardPositionsByCharacter;

  return {
    ...mergedSanitized,
    boardPositionsByCharacter: finalSyncedGear,
    currencyBoardPositionsByCharacter: finalSyncedCurrency,
  };
}

export const useGearStore = create<GearStore>((set, get) => ({
  ...initialState,
  initialize: (
    inventories,
    loadouts,
    boardPositionsByCharacter = createEmptyGearBoardPositionsByCharacter(),
    craftingCurrencies = initialState.craftingCurrencies,
    equippedReturnPositions = {},
    currencyBoardPositionsByCharacter = createEmptyCurrencyBoardPositionsByCharacter(),
  ) => {
    const flatInventory = flattenGearInventories(inventories);
    const inventoryIds = new Set(flatInventory.map((item) => item.instanceId));
    const nextReturn: GearBoardPositions = {};
    for (const [instanceId, position] of Object.entries(equippedReturnPositions)) {
      if (inventoryIds.has(instanceId)) nextReturn[instanceId] = position;
    }
    const normalizedCurrencies = normalizeCraftingCurrencies(craftingCurrencies);
    set((state) => {
      return updateGearStateAndSync(state, {
        inventories,
        loadouts,
        boardPositionsByCharacter,
        equippedReturnPositions: nextReturn,
        craftingCurrencies: normalizedCurrencies,
        currencyBoardPositionsByCharacter,
      });
    });
  },
  addInstance: (instance, characterId) =>
    set((state) => {
      const nextInventories = {
        ...state.inventories,
        [characterId]: [...(state.inventories[characterId] ?? []), instance],
      };
      return updateGearStateAndSync(state, { inventories: nextInventories });
    }),
  transferToInventory: (instanceId, targetCharacterId) => {
    const state = get();
    const owner = findGearInventoryOwner(state.inventories, instanceId);
    if (!owner || owner === targetCharacterId) return false;

    const instance = state.inventories[owner].find((item) => item.instanceId === instanceId);
    if (!instance) return false;

    const nextInventories = {
      ...state.inventories,
      [owner]: state.inventories[owner].filter((item) => item.instanceId !== instanceId),
      [targetCharacterId]: [...(state.inventories[targetCharacterId] ?? []), instance],
    };

    const nextLoadouts: GearLoadouts = { ...state.loadouts };
    for (const characterId of GEAR_CHARACTER_IDS) {
      const nextLoadout = { ...nextLoadouts[characterId] };
      for (const slot of Object.keys(nextLoadout) as GearSlot[]) {
        if (nextLoadout[slot] === instanceId) nextLoadout[slot] = null;
      }
      nextLoadouts[characterId] = nextLoadout;
    }

    const nextPositionsByCharacter = { ...state.boardPositionsByCharacter };
    const ownerPositions = { ...(nextPositionsByCharacter[owner] ?? {}) };
    const targetPositions = { ...(nextPositionsByCharacter[targetCharacterId] ?? {}) };
    const nextReturn = { ...state.equippedReturnPositions };
    const transferPosition = ownerPositions[instanceId] ?? nextReturn[instanceId];
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- imperative object-based registry
    delete ownerPositions[instanceId];
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- imperative object-based registry
    delete nextReturn[instanceId];
    if (transferPosition) {
      targetPositions[instanceId] = transferPosition;
    }
    nextPositionsByCharacter[owner] = ownerPositions;
    nextPositionsByCharacter[targetCharacterId] = targetPositions;

    set((state) =>
      updateGearStateAndSync(state, {
        inventories: nextInventories,
        loadouts: nextLoadouts,
        boardPositionsByCharacter: nextPositionsByCharacter,
        equippedReturnPositions: nextReturn,
      }),
    );
    return true;
  },
  equip: (characterId, slot, instance, options) =>
    set((state) => {
      const flatInventory = flattenGearInventories(state.inventories);
      const displacedId = state.loadouts[characterId]?.[slot] ?? null;
      const nextLoadouts = equipGear(state.loadouts, characterId, slot, instance, flatInventory);
      const nextPositionsByCharacter = { ...state.boardPositionsByCharacter };
      const characterPositions = { ...(nextPositionsByCharacter[characterId] ?? {}) };
      const nextReturn = { ...state.equippedReturnPositions };

      const currentOwner = findGearInventoryOwner(state.inventories, instance.instanceId);
      let nextInventories = state.inventories;
      if (currentOwner && currentOwner !== characterId) {
        nextInventories = {
          ...state.inventories,
          [currentOwner]: state.inventories[currentOwner].filter((item) => item.instanceId !== instance.instanceId),
          [characterId]: [...(state.inventories[characterId] ?? []), instance],
        };
        const currentOwnerPositions = { ...(nextPositionsByCharacter[currentOwner] ?? {}) };
        if (currentOwnerPositions[instance.instanceId]) {
          characterPositions[instance.instanceId] = currentOwnerPositions[instance.instanceId]!;
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- imperative object-based registry
          delete currentOwnerPositions[instance.instanceId];
          nextPositionsByCharacter[currentOwner] = currentOwnerPositions;
        }
      }

      const originalLoadout = state.loadouts[characterId];
      const nextLoadout = nextLoadouts[characterId];
      if (originalLoadout && nextLoadout) {
        for (const gearSlot of GEAR_SLOTS) {
          const origInstanceId = originalLoadout[gearSlot];
          const nextInstanceId = nextLoadout[gearSlot];
          if (origInstanceId && !nextInstanceId && origInstanceId !== instance.instanceId) {
            if (nextReturn[origInstanceId]) {
              characterPositions[origInstanceId] = nextReturn[origInstanceId];
              // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- imperative object-based registry
              delete nextReturn[origInstanceId];
            }
          }
        }
      }

      if (options?.vacatedPlacement) {
        const currentPos = characterPositions[instance.instanceId];
        if (currentPos) {
          nextReturn[instance.instanceId] = currentPos;
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- imperative object-based registry
          delete characterPositions[instance.instanceId];
        }
        if (options.swapDisplaced !== false && displacedId && displacedId !== instance.instanceId) {
          characterPositions[displacedId] = options.vacatedPlacement;
        }
      }

      nextPositionsByCharacter[characterId] = characterPositions;

      return updateGearStateAndSync(state, {
        inventories: nextInventories,
        loadouts: nextLoadouts,
        boardPositionsByCharacter: nextPositionsByCharacter,
        equippedReturnPositions: nextReturn,
      });
    }),
  unequip: (characterId, slot) =>
    set((state) => {
      const instanceId = state.loadouts[characterId]?.[slot];
      const nextLoadouts = unequipGear(state.loadouts, characterId, slot);
      const nextPositionsByCharacter = { ...state.boardPositionsByCharacter };
      const characterPositions = { ...(nextPositionsByCharacter[characterId] ?? {}) };
      const nextReturn = { ...state.equippedReturnPositions };
      if (instanceId && nextReturn[instanceId]) {
        characterPositions[instanceId] = nextReturn[instanceId];
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- imperative object-based registry
        delete nextReturn[instanceId];
      }
      nextPositionsByCharacter[characterId] = characterPositions;
      return updateGearStateAndSync(state, {
        loadouts: nextLoadouts,
        boardPositionsByCharacter: nextPositionsByCharacter,
        equippedReturnPositions: nextReturn,
      });
    }),
  moveBoardItem: (characterId, item, col, row) =>
    set((state) => moveBoardItemForState(state, characterId, item, col, row)),
  syncBoardPositions: () =>
    set((state) => {
      return updateGearStateAndSync(state, {});
    }),
  salvage: (instanceId, options) => {
    const state = get();
    const owner = findGearInventoryOwner(state.inventories, instanceId);
    if (!owner) return null;

    const flatInventory = flattenGearInventories(state.inventories);
    const result = salvageGear(flatInventory, state.loadouts, instanceId, options?.rng ?? Math.random);
    if (!result) return null;

    const nextPositionsByCharacter = { ...state.boardPositionsByCharacter };
    const ownerPositions = { ...(nextPositionsByCharacter[owner] ?? {}) };
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- imperative object-based registry
    delete ownerPositions[instanceId];

    const nextReturn = { ...state.equippedReturnPositions };
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- imperative object-based registry
    delete nextReturn[instanceId];

    const nextInventories = {
      ...state.inventories,
      [owner]: state.inventories[owner].filter((item) => item.instanceId !== instanceId),
    };

    const nextCurrencies = addCraftingCurrencies(state.craftingCurrencies, result.yieldedCurrencies);

    set(
      updateGearStateAndSync(state, {
        inventories: nextInventories,
        loadouts: result.loadouts,
        boardPositionsByCharacter: nextPositionsByCharacter,
        equippedReturnPositions: nextReturn,
        craftingCurrencies: nextCurrencies,
        currencyBoardPositionsByCharacter: state.currencyBoardPositionsByCharacter,
      }),
    );
    return { inventories: nextInventories, yieldedCurrencies: result.yieldedCurrencies };
  },
  applyCurrency: (currencyId, instanceId, options) => {
    const state = get();
    const owner = findGearInventoryOwner(state.inventories, instanceId);
    if (!owner) return false;

    const item = state.inventories[owner].find((i) => i.instanceId === instanceId);
    if (!item) return false;
    if ((state.craftingCurrencies[currencyId] ?? 0) < 1) return false;
    if (!canApplyCraftingCurrency(currencyId, item)) return false;

    const updatedItem = applyCraftingCurrency(currencyId, item, options?.rng ?? Math.random);
    const nextInventories = {
      ...state.inventories,
      [owner]: state.inventories[owner].map((i) => (i.instanceId === instanceId ? updatedItem : i)),
    };
    const nextCurrencies = normalizeCraftingCurrencies({
      ...state.craftingCurrencies,
      [currencyId]: (state.craftingCurrencies[currencyId] ?? 0) - 1,
    });

    set(
      updateGearStateAndSync(state, {
        inventories: nextInventories,
        craftingCurrencies: nextCurrencies,
        currencyBoardPositionsByCharacter: state.currencyBoardPositionsByCharacter,
      }),
    );
    return true;
  },
  addCurrencies: (currencies) =>
    set((state) => {
      const nextCurrencies = addCraftingCurrencies(state.craftingCurrencies, currencies);
      return updateGearStateAndSync(state, {
        craftingCurrencies: nextCurrencies,
        currencyBoardPositionsByCharacter: state.currencyBoardPositionsByCharacter,
      });
    }),
  reset: () => set(initialState),
}));
