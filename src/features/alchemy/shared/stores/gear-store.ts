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
  sanitizeGearBoardPositions,
  footprintForInstance,
  CRAFTING_CURRENCY_IDS,
  INVENTORY_COLS,
  GEAR_CHARACTER_IDS,
  GEAR_SLOTS,
  resolveMoveWithSwap,
  packMixedBoard,
} from "@/lib/gear";

type BoardEntry =
  | { id: string; kind: "gear"; item: GearInstance; saved?: { col: number; row: number } }
  | { id: string; kind: "currency"; item: CraftingCurrencyId; saved?: { col: number; row: number } };

function buildBoardItemsForCharacter(state: GearStore, characterId: CharacterId): BoardEntry[] {
  const equippedInstanceIds = new Set(Object.values(state.loadouts[characterId] ?? {}).filter(Boolean) as string[]);
  const availableInventory = (state.inventories[characterId] ?? []).filter(
    (item) => !equippedInstanceIds.has(item.instanceId),
  );
  const activeCurrencies = CRAFTING_CURRENCY_IDS.filter((id) => (state.craftingCurrencies[id] ?? 0) > 0);
  const gearPositions = state.boardPositionsByCharacter[characterId] ?? {};
  const currencyPositions = state.currencyBoardPositionsByCharacter[characterId] ?? {};

  const entries: BoardEntry[] = [];

  for (const item of availableInventory) {
    const saved = gearPositions[item.instanceId];
    if (saved) {
      entries.push({ id: item.instanceId, kind: "gear", item, saved });
    } else {
      entries.push({ id: item.instanceId, kind: "gear", item });
    }
  }

  for (const currencyId of activeCurrencies) {
    const saved = currencyPositions[currencyId];
    if (saved) {
      entries.push({ id: currencyId, kind: "currency", item: currencyId, saved });
    } else {
      entries.push({ id: currencyId, kind: "currency", item: currencyId });
    }
  }

  return entries;
}

function resolveMoveItemAndSwap(
  characterId: CharacterId,
  movingId: string,
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

  const entries = buildBoardItemsForCharacter(state, characterId);

  type DragBoardItem = {
    id: string;
    kind: "gear" | "currency";
    footprint: { w: number; h: number };
    position: { col: number; row: number };
  };
  const boardItems: DragBoardItem[] = [];
  for (const entry of entries) {
    if (entry.kind === "gear") {
      const fp = footprintForInstance(entry.item);
      if (!fp) continue;
      boardItems.push({ id: entry.id, kind: "gear", footprint: fp, position: entry.saved ?? { col: 1, row: 1 } });
    } else {
      boardItems.push({
        id: entry.id,
        kind: "currency",
        footprint: { w: 1, h: 1 },
        position: entry.saved ?? { col: 1, row: 1 },
      });
    }
  }

  if (!boardItems.some((item) => item.id === movingId)) {
    return { nextGearPositions, nextCurrencyPositions };
  }

  const { positions, unchanged } = resolveMoveWithSwap(
    boardItems,
    movingId,
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
  setBoardPosition: (characterId: CharacterId, instanceId: string, col: number, row: number) => void;
  setCurrencyBoardPosition: (
    characterId: CharacterId,
    currencyId: CraftingCurrencyId,
    col: number,
    row: number,
  ) => void;
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
    const equippedInstanceIds = new Set(Object.values(state.loadouts[characterId] ?? {}).filter(Boolean) as string[]);
    const availableInventory = (state.inventories[characterId] ?? []).filter(
      (item) => !equippedInstanceIds.has(item.instanceId),
    );
    const activeCurrencies = CRAFTING_CURRENCY_IDS.filter((id) => (state.craftingCurrencies[id] ?? 0) > 0);
    const gearPositions = { ...(nextBoardPositionsByCharacter[characterId] ?? {}) };
    const currencyPositions = { ...(nextCurrencyPositionsByCharacter[characterId] ?? {}) };

    type MixedItem =
      | { id: string; kind: "gear"; item: GearInstance; saved: { col: number; row: number } | undefined }
      | { id: string; kind: "currency"; item: CraftingCurrencyId; saved: { col: number; row: number } | undefined };
    const mixed: MixedItem[] = [];

    for (const item of availableInventory) {
      const fp = footprintForInstance(item);
      if (!fp) continue;
      mixed.push({ id: item.instanceId, kind: "gear", item, saved: gearPositions[item.instanceId] });
    }
    for (const currencyId of activeCurrencies) {
      mixed.push({ id: currencyId, kind: "currency", item: currencyId, saved: currencyPositions[currencyId] });
    }

    const packed = packMixedBoard<"gear" | "currency", MixedItem>(
      mixed,
      INVENTORY_COLS,
      (entry: MixedItem) => (entry.kind === "gear" ? footprintForInstance(entry.item)! : { w: 1, h: 1 }),
      (entry: MixedItem) => entry.saved,
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
      const nextState = {
        inventories,
        loadouts,
        boardPositionsByCharacter: sanitizeGearBoardPositionsByCharacter(boardPositionsByCharacter, inventories),
        equippedReturnPositions: nextReturn,
        craftingCurrencies: normalizedCurrencies,
        currencyBoardPositionsByCharacter: sanitizeCurrencyBoardPositionsByCharacter(
          currencyBoardPositionsByCharacter,
          normalizedCurrencies,
        ),
      };
      return {
        ...nextState,
        ...syncBoardPositionsForState({
          ...state,
          ...nextState,
        }),
      };
    });
  },
  addInstance: (instance, characterId) =>
    set((state) => {
      const nextInventories = {
        ...state.inventories,
        [characterId]: [...(state.inventories[characterId] ?? []), instance],
      };
      const nextState = {
        inventories: nextInventories,
      };
      return {
        ...nextState,
        ...syncBoardPositionsForState({
          ...state,
          ...nextState,
        }),
      };
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
    delete ownerPositions[instanceId];
    delete nextReturn[instanceId];
    if (transferPosition) {
      targetPositions[instanceId] = transferPosition;
    }
    nextPositionsByCharacter[owner] = ownerPositions;
    nextPositionsByCharacter[targetCharacterId] = targetPositions;

    const nextState = {
      inventories: nextInventories,
      loadouts: nextLoadouts,
      boardPositionsByCharacter: sanitizeGearBoardPositionsByCharacter(nextPositionsByCharacter, nextInventories),
      equippedReturnPositions: nextReturn,
    };
    set({
      ...nextState,
      ...syncBoardPositionsForState({
        ...state,
        ...nextState,
      }),
    });
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

      // Find current owner of the item in inventories
      const currentOwner = findGearInventoryOwner(state.inventories, instance.instanceId);
      let nextInventories = state.inventories;
      if (currentOwner && currentOwner !== characterId) {
        // Remove from currentOwner's inventory, add to characterId's inventory
        nextInventories = {
          ...state.inventories,
          [currentOwner]: state.inventories[currentOwner].filter((item) => item.instanceId !== instance.instanceId),
          [characterId]: [...(state.inventories[characterId] ?? []), instance],
        };
        // Move board position from currentOwner to characterId
        const currentOwnerPositions = { ...(nextPositionsByCharacter[currentOwner] ?? {}) };
        if (currentOwnerPositions[instance.instanceId]) {
          characterPositions[instance.instanceId] = currentOwnerPositions[instance.instanceId];
          delete currentOwnerPositions[instance.instanceId];
          nextPositionsByCharacter[currentOwner] = currentOwnerPositions;
        }
      }

      // Restore positions for any indirectly unequipped items (e.g., off-hand cleared by resolveHandConflicts)
      const originalLoadout = state.loadouts[characterId];
      const nextLoadout = nextLoadouts[characterId];
      if (originalLoadout && nextLoadout) {
        for (const gearSlot of GEAR_SLOTS) {
          const origInstanceId = originalLoadout[gearSlot];
          const nextInstanceId = nextLoadout[gearSlot];
          if (origInstanceId && !nextInstanceId && origInstanceId !== instance.instanceId) {
            if (nextReturn[origInstanceId]) {
              characterPositions[origInstanceId] = nextReturn[origInstanceId];
              delete nextReturn[origInstanceId];
            }
          }
        }
      }

      if (options?.vacatedPlacement) {
        const currentPos = characterPositions[instance.instanceId];
        if (currentPos) {
          nextReturn[instance.instanceId] = currentPos;
          delete characterPositions[instance.instanceId];
        }
        if (options.swapDisplaced !== false && displacedId && displacedId !== instance.instanceId) {
          characterPositions[displacedId] = options.vacatedPlacement;
        }
      }

      nextPositionsByCharacter[characterId] = characterPositions;

      const nextState = {
        inventories: nextInventories,
        loadouts: nextLoadouts,
        boardPositionsByCharacter: sanitizeGearBoardPositionsByCharacter(nextPositionsByCharacter, nextInventories),
        equippedReturnPositions: nextReturn,
      };

      return {
        ...nextState,
        ...syncBoardPositionsForState({
          ...state,
          ...nextState,
        }),
      };
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
        delete nextReturn[instanceId];
      }
      nextPositionsByCharacter[characterId] = characterPositions;
      const nextState = {
        loadouts: nextLoadouts,
        boardPositionsByCharacter: sanitizeGearBoardPositionsByCharacter(nextPositionsByCharacter, state.inventories),
        equippedReturnPositions: nextReturn,
      };
      return {
        ...nextState,
        ...syncBoardPositionsForState({
          ...state,
          ...nextState,
        }),
      };
    }),
  setBoardPosition: (characterId, instanceId, col, row) =>
    set((state) => {
      const { nextGearPositions, nextCurrencyPositions } = resolveMoveItemAndSwap(
        characterId,
        instanceId,
        col,
        row,
        state,
      );
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
    }),
  setCurrencyBoardPosition: (characterId, currencyId, col, row) =>
    set((state) => {
      const { nextGearPositions, nextCurrencyPositions } = resolveMoveItemAndSwap(
        characterId,
        currencyId,
        col,
        row,
        state,
      );
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
    }),
  syncBoardPositions: () =>
    set((state) => {
      return syncBoardPositionsForState(state);
    }),
  salvage: (instanceId, options) => {
    const state = get();
    const owner = findGearInventoryOwner(state.inventories, instanceId);
    if (!owner) return null;

    const flatInventory = flattenGearInventories(state.inventories);
    const result = salvageGear(flatInventory, state.loadouts, instanceId, options?.rng);
    if (!result) return null;

    const nextPositionsByCharacter = { ...state.boardPositionsByCharacter };
    const ownerPositions = { ...(nextPositionsByCharacter[owner] ?? {}) };
    delete ownerPositions[instanceId];
    nextPositionsByCharacter[owner] = sanitizeGearBoardPositions(
      ownerPositions,
      state.inventories[owner].filter((item) => item.instanceId !== instanceId),
    );

    const nextReturn = { ...state.equippedReturnPositions };
    delete nextReturn[instanceId];

    const nextInventories = {
      ...state.inventories,
      [owner]: state.inventories[owner].filter((item) => item.instanceId !== instanceId),
    };

    const nextCurrencies = addCraftingCurrencies(state.craftingCurrencies, result.yieldedCurrencies);

    const nextState = {
      inventories: nextInventories,
      loadouts: result.loadouts,
      boardPositionsByCharacter: nextPositionsByCharacter,
      equippedReturnPositions: nextReturn,
      craftingCurrencies: nextCurrencies,
      currencyBoardPositionsByCharacter: sanitizeCurrencyBoardPositionsByCharacter(
        state.currencyBoardPositionsByCharacter,
        nextCurrencies,
      ),
    };

    set({
      ...nextState,
      ...syncBoardPositionsForState({
        ...state,
        ...nextState,
      }),
    });
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

    const updatedItem = applyCraftingCurrency(currencyId, item, options?.rng);
    const nextInventories = {
      ...state.inventories,
      [owner]: state.inventories[owner].map((i) => (i.instanceId === instanceId ? updatedItem : i)),
    };
    const nextCurrencies = normalizeCraftingCurrencies({
      ...state.craftingCurrencies,
      [currencyId]: (state.craftingCurrencies[currencyId] ?? 0) - 1,
    });

    const nextState = {
      inventories: nextInventories,
      craftingCurrencies: nextCurrencies,
      currencyBoardPositionsByCharacter: sanitizeCurrencyBoardPositionsByCharacter(
        state.currencyBoardPositionsByCharacter,
        nextCurrencies,
      ),
    };

    set({
      ...nextState,
      ...syncBoardPositionsForState({
        ...state,
        ...nextState,
      }),
    });
    return true;
  },
  addCurrencies: (currencies) =>
    set((state) => {
      const nextCurrencies = addCraftingCurrencies(state.craftingCurrencies, currencies);
      const nextState = {
        craftingCurrencies: nextCurrencies,
        currencyBoardPositionsByCharacter: sanitizeCurrencyBoardPositionsByCharacter(
          state.currencyBoardPositionsByCharacter,
          nextCurrencies,
        ),
      };
      return {
        ...nextState,
        ...syncBoardPositionsForState({
          ...state,
          ...nextState,
        }),
      };
    }),
  reset: () => set(initialState),
}));
