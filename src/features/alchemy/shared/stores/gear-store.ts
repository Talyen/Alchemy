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
        loadouts: nextLoadouts,
        boardPositionsByCharacter: sanitizeGearBoardPositionsByCharacter(nextPositionsByCharacter, state.inventories),
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
    set((state) => ({
      boardPositionsByCharacter: {
        ...state.boardPositionsByCharacter,
        [characterId]: {
          ...(state.boardPositionsByCharacter[characterId] ?? {}),
          [instanceId]: { col, row },
        },
      },
    })),
  setCurrencyBoardPosition: (characterId, currencyId, col, row) =>
    set((state) => ({
      currencyBoardPositionsByCharacter: {
        ...state.currencyBoardPositionsByCharacter,
        [characterId]: {
          ...(state.currencyBoardPositionsByCharacter[characterId] ?? {}),
          [currencyId]: { col, row },
        },
      },
    })),
  syncBoardPositions: () =>
    set((state) => {
      const nextBoardPositionsByCharacter = sanitizeGearBoardPositionsByCharacter(
        state.boardPositionsByCharacter,
        state.inventories,
      );
      const nextCurrencyPositionsByCharacter = sanitizeCurrencyBoardPositionsByCharacter(
        state.currencyBoardPositionsByCharacter,
        state.craftingCurrencies,
      );
      if (
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
