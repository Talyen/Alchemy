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
} from "@/lib/gear";

const LEGACY_ARMORY_POSITIONS_KEY = "alchemy-armory-positions";

function readLegacyBoardPositions(): GearBoardPositions {
  if (typeof localStorage === "undefined") return {};
  try {
    const stored = localStorage.getItem(LEGACY_ARMORY_POSITIONS_KEY);
    if (!stored) return {};
    localStorage.removeItem(LEGACY_ARMORY_POSITIONS_KEY);
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as GearBoardPositions;
  } catch {
    return {};
  }
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

  const equippedInstanceIds = new Set(Object.values(state.loadouts[characterId] ?? {}).filter(Boolean) as string[]);
  const availableInventory = (state.inventories[characterId] ?? []).filter(
    (item) => !equippedInstanceIds.has(item.instanceId),
  );
  const activeCurrencies = CRAFTING_CURRENCY_IDS.filter((id) => (state.craftingCurrencies[id] ?? 0) > 0);

  const getFootprint = (id: string): { w: number; h: number } | null => {
    const gearItem = availableInventory.find((item) => item.instanceId === id);
    if (gearItem) {
      return footprintForInstance(gearItem);
    }
    if (activeCurrencies.includes(id as CraftingCurrencyId)) {
      return { w: 1, h: 1 };
    }
    return null;
  };

  const movingFootprint = getFootprint(movingId);
  if (!movingFootprint) {
    return { nextGearPositions, nextCurrencyPositions };
  }

  type BoardItem = {
    id: string;
    kind: "gear" | "currency";
    w: number;
    h: number;
    origCol: number;
    origRow: number;
    col: number;
    row: number;
  };

  const boardItems: BoardItem[] = [];

  for (const item of availableInventory) {
    const fp = footprintForInstance(item);
    if (!fp) continue;
    const pos = nextGearPositions[item.instanceId] || { col: 1, row: 1 };
    boardItems.push({
      id: item.instanceId,
      kind: "gear",
      w: fp.w,
      h: fp.h,
      origCol: pos.col,
      origRow: pos.row,
      col: pos.col,
      row: pos.row,
    });
  }

  for (const currencyId of activeCurrencies) {
    const pos = nextCurrencyPositions[currencyId] || { col: 1, row: 1 };
    boardItems.push({
      id: currencyId,
      kind: "currency",
      w: 1,
      h: 1,
      origCol: pos.col,
      origRow: pos.row,
      col: pos.col,
      row: pos.row,
    });
  }

  const movingItem = boardItems.find((x) => x.id === movingId);
  if (!movingItem) {
    return { nextGearPositions, nextCurrencyPositions };
  }

  movingItem.col = targetCol;
  movingItem.row = targetRow;

  const overlaps = (
    p1: { col: number; row: number; w: number; h: number },
    p2: { col: number; row: number; w: number; h: number },
  ) => {
    return !(p1.col + p1.w <= p2.col || p2.col + p2.w <= p1.col || p1.row + p1.h <= p2.row || p2.row + p2.h <= p1.row);
  };

  const displacedItems: BoardItem[] = [];
  const fixedItems: BoardItem[] = [];

  for (const item of boardItems) {
    if (item.id === movingId) continue;
    if (overlaps(movingItem, item)) {
      displacedItems.push(item);
    } else {
      fixedItems.push(item);
    }
  }

  displacedItems.sort((a, b) => b.w * b.h - a.w * a.h);

  const placedItems: BoardItem[] = [movingItem, ...fixedItems];

  const isPositionOccupied = (col: number, row: number, w: number, h: number) => {
    if (col < 1 || col + w - 1 > INVENTORY_COLS || row < 1) return true;
    return placedItems.some((placed) => overlaps({ col, row, w, h }, placed));
  };

  for (const item of displacedItems) {
    let bestCol = 1;
    let bestRow = 1;
    let minDistanceSq = Number.POSITIVE_INFINITY;

    for (let r = 1; r <= 40; r++) {
      for (let c = 1; c <= INVENTORY_COLS - item.w + 1; c++) {
        if (!isPositionOccupied(c, r, item.w, item.h)) {
          const origCenterX = item.origCol + (item.w - 1) / 2;
          const origCenterY = item.origRow + (item.h - 1) / 2;
          const candCenterX = c + (item.w - 1) / 2;
          const candCenterY = r + (item.h - 1) / 2;
          const distSq = (origCenterX - candCenterX) ** 2 + (origCenterY - candCenterY) ** 2;

          if (distSq < minDistanceSq) {
            minDistanceSq = distSq;
            bestCol = c;
            bestRow = r;
          }
        }
      }
    }

    item.col = bestCol;
    item.row = bestRow;
    placedItems.push(item);
  }

  for (const item of placedItems) {
    if (item.kind === "gear") {
      nextGearPositions[item.id] = { col: item.col, row: item.row };
    } else {
      nextCurrencyPositions[item.id as CraftingCurrencyId] = { col: item.col, row: item.row };
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
    const legacy = Object.keys(boardPositionsByCharacter.knight ?? {}).length === 0 ? readLegacyBoardPositions() : {};
    const knightBoard = { ...legacy, ...(boardPositionsByCharacter.knight ?? {}) };
    const mergedBoardPositionsByCharacter = {
      ...boardPositionsByCharacter,
      knight: knightBoard,
    };
    const flatInventory = flattenGearInventories(inventories);
    const inventoryIds = new Set(flatInventory.map((item) => item.instanceId));
    const nextReturn: GearBoardPositions = {};
    for (const [instanceId, position] of Object.entries(equippedReturnPositions)) {
      if (inventoryIds.has(instanceId)) nextReturn[instanceId] = position;
    }
    const normalizedCurrencies = normalizeCraftingCurrencies(craftingCurrencies);
    set({
      inventories,
      loadouts,
      boardPositionsByCharacter: sanitizeGearBoardPositionsByCharacter(mergedBoardPositionsByCharacter, inventories),
      equippedReturnPositions: nextReturn,
      craftingCurrencies: normalizedCurrencies,
      currencyBoardPositionsByCharacter: sanitizeCurrencyBoardPositionsByCharacter(
        currencyBoardPositionsByCharacter,
        normalizedCurrencies,
      ),
    });
  },
  addInstance: (instance, characterId) =>
    set((state) => ({
      inventories: {
        ...state.inventories,
        [characterId]: [...(state.inventories[characterId] ?? []), instance],
      },
    })),
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

      return {
        inventories: nextInventories,
        loadouts: nextLoadouts,
        boardPositionsByCharacter: sanitizeGearBoardPositionsByCharacter(nextPositionsByCharacter, nextInventories),
        equippedReturnPositions: nextReturn,
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
      return {
        loadouts: nextLoadouts,
        boardPositionsByCharacter: sanitizeGearBoardPositionsByCharacter(nextPositionsByCharacter, state.inventories),
        equippedReturnPositions: nextReturn,
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
      return {
        boardPositionsByCharacter: {
          ...state.boardPositionsByCharacter,
          [characterId]: nextGearPositions,
        },
        currencyBoardPositionsByCharacter: {
          ...state.currencyBoardPositionsByCharacter,
          [characterId]: nextCurrencyPositions,
        },
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
      return {
        boardPositionsByCharacter: {
          ...state.boardPositionsByCharacter,
          [characterId]: nextGearPositions,
        },
        currencyBoardPositionsByCharacter: {
          ...state.currencyBoardPositionsByCharacter,
          [characterId]: nextCurrencyPositions,
        },
      };
    }),
  syncBoardPositions: () =>
    set((state) => {
      let changed = false;
      const nextBoardPositionsByCharacter = { ...state.boardPositionsByCharacter };
      const nextCurrencyPositionsByCharacter = { ...state.currencyBoardPositionsByCharacter };

      for (const characterId of GEAR_CHARACTER_IDS) {
        const equippedInstanceIds = new Set(
          Object.values(state.loadouts[characterId] ?? {}).filter(Boolean) as string[],
        );
        const availableInventory = (state.inventories[characterId] ?? []).filter(
          (item) => !equippedInstanceIds.has(item.instanceId),
        );
        const activeCurrencies = CRAFTING_CURRENCY_IDS.filter((id) => (state.craftingCurrencies[id] ?? 0) > 0);

        const gearPositions = { ...(nextBoardPositionsByCharacter[characterId] ?? {}) };
        const currencyPositions = { ...(nextCurrencyPositionsByCharacter[characterId] ?? {}) };

        const occupancy: boolean[][] = [];
        const ensureRows = (rows: number) => {
          while (occupancy.length < rows) {
            occupancy.push(Array(INVENTORY_COLS).fill(false));
          }
        };
        const canPlace = (col: number, row: number, w: number, h: number) => {
          if (col < 1 || col + w - 1 > INVENTORY_COLS || row < 1) return false;
          ensureRows(row + h - 1);
          for (let y = row - 1; y < row - 1 + h; y++) {
            for (let x = col - 1; x < col - 1 + w; x++) {
              if (occupancy[y]?.[x]) return false;
            }
          }
          return true;
        };
        const markPlaced = (col: number, row: number, w: number, h: number) => {
          ensureRows(row + h - 1);
          for (let y = row - 1; y < row - 1 + h; y++) {
            for (let x = col - 1; x < col - 1 + w; x++) {
              occupancy[y]![x] = true;
            }
          }
        };

        const toPlaceGear: GearInstance[] = [];
        for (const item of availableInventory) {
          const fp = footprintForInstance(item);
          if (!fp) continue;
          const pos = gearPositions[item.instanceId];
          if (pos && canPlace(pos.col, pos.row, fp.w, fp.h)) {
            markPlaced(pos.col, pos.row, fp.w, fp.h);
          } else {
            toPlaceGear.push(item);
          }
        }

        const toPlaceCurrencies: CraftingCurrencyId[] = [];
        for (const currencyId of activeCurrencies) {
          const pos = currencyPositions[currencyId];
          if (pos && canPlace(pos.col, pos.row, 1, 1)) {
            markPlaced(pos.col, pos.row, 1, 1);
          } else {
            toPlaceCurrencies.push(currencyId);
          }
        }

        const findFirstAvailable = (w: number, h: number) => {
          for (let r = 1; ; r++) {
            for (let c = 1; c <= INVENTORY_COLS - w + 1; c++) {
              if (canPlace(c, r, w, h)) {
                return { col: c, row: r };
              }
            }
          }
        };

        for (const item of toPlaceGear) {
          const fp = footprintForInstance(item);
          if (!fp) continue;
          const pos = findFirstAvailable(fp.w, fp.h);
          markPlaced(pos.col, pos.row, fp.w, fp.h);
          gearPositions[item.instanceId] = pos;
          changed = true;
        }

        for (const currencyId of toPlaceCurrencies) {
          const pos = findFirstAvailable(1, 1);
          markPlaced(pos.col, pos.row, 1, 1);
          currencyPositions[currencyId] = pos;
          changed = true;
        }

        const gearIds = new Set(availableInventory.map((item) => item.instanceId));
        for (const id of Object.keys(gearPositions)) {
          if (!gearIds.has(id)) {
            delete gearPositions[id];
            changed = true;
          }
        }
        for (const id of Object.keys(currencyPositions)) {
          if (!activeCurrencies.includes(id as CraftingCurrencyId)) {
            delete currencyPositions[id as CraftingCurrencyId];
            changed = true;
          }
        }

        nextBoardPositionsByCharacter[characterId] = gearPositions;
        nextCurrencyPositionsByCharacter[characterId] = currencyPositions;
      }

      if (
        !changed &&
        boardPositionsByCharacterEqual(state.boardPositionsByCharacter, nextBoardPositionsByCharacter) &&
        currencyBoardPositionsByCharacterEqual(
          state.currencyBoardPositionsByCharacter,
          nextCurrencyPositionsByCharacter,
        )
      ) {
        return state;
      }

      return {
        boardPositionsByCharacter: nextBoardPositionsByCharacter,
        currencyBoardPositionsByCharacter: nextCurrencyPositionsByCharacter,
      };
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

    set({
      inventories: nextInventories,
      loadouts: result.loadouts,
      boardPositionsByCharacter: nextPositionsByCharacter,
      equippedReturnPositions: nextReturn,
      craftingCurrencies: nextCurrencies,
      currencyBoardPositionsByCharacter: sanitizeCurrencyBoardPositionsByCharacter(
        state.currencyBoardPositionsByCharacter,
        nextCurrencies,
      ),
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

    set({
      inventories: nextInventories,
      craftingCurrencies: nextCurrencies,
      currencyBoardPositionsByCharacter: sanitizeCurrencyBoardPositionsByCharacter(
        state.currencyBoardPositionsByCharacter,
        nextCurrencies,
      ),
    });
    return true;
  },
  addCurrencies: (currencies) =>
    set((state) => {
      const nextCurrencies = addCraftingCurrencies(state.craftingCurrencies, currencies);
      return {
        craftingCurrencies: nextCurrencies,
        currencyBoardPositionsByCharacter: sanitizeCurrencyBoardPositionsByCharacter(
          state.currencyBoardPositionsByCharacter,
          nextCurrencies,
        ),
      };
    }),
  reset: () => set(initialState),
}));

/** Flattened gear inventory across all characters — for battle manifest and health sync. */
export function readFlatGearInventory(): GearInstance[] {
  return flattenGearInventories(useGearStore.getState().inventories);
}
