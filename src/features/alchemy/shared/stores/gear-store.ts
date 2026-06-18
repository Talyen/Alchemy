import { create } from "zustand";
import type { CharacterId } from "@/lib/game-data";
import {
  createEmptyGearLoadouts,
  equipGear,
  sanitizeGearBoardPositions,
  salvageGear,
  unequipGear,
  type GearBoardPositions,
  type GearInstance,
  type GearLoadouts,
  type GearSlot,
  type CraftingCurrencyId,
  type CraftingCurrencyBoardPositions,
  canApplyCraftingCurrency,
  applyCraftingCurrency,
  EMPTY_CRAFTING_CURRENCIES,
  addCraftingCurrencies,
  normalizeCraftingCurrencies,
  sanitizeCurrencyBoardPositions,
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
  inventory: GearInstance[];
  loadouts: GearLoadouts;
  boardPositions: GearBoardPositions;
  equippedReturnPositions: GearBoardPositions;
  currencyBoardPositions: CraftingCurrencyBoardPositions;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  initialize: (
    inventory: GearInstance[],
    loadouts: GearLoadouts,
    boardPositions?: GearBoardPositions,
    craftingCurrencies?: Partial<Record<CraftingCurrencyId, number>>,
    equippedReturnPositions?: GearBoardPositions,
    currencyBoardPositions?: CraftingCurrencyBoardPositions,
  ) => void;
  addInstance: (instance: GearInstance) => void;
  equip: (
    characterId: CharacterId,
    slot: GearSlot,
    instance: GearInstance,
    options?: { vacatedPlacement?: { col: number; row: number }; swapDisplaced?: boolean },
  ) => void;
  unequip: (characterId: CharacterId, slot: GearSlot) => void;
  setBoardPosition: (instanceId: string, col: number, row: number) => void;
  setCurrencyBoardPosition: (currencyId: CraftingCurrencyId, col: number, row: number) => void;
  syncBoardPositions: () => void;
  salvage: (
    instanceId: string,
    options?: { rng?: () => number },
  ) => { inventory: GearInstance[]; yieldedCurrencies: Record<CraftingCurrencyId, number> } | null;
  applyCurrency: (currencyId: CraftingCurrencyId, instanceId: string, options?: { rng?: () => number }) => boolean;
  addCurrencies: (currencies: Partial<Record<CraftingCurrencyId, number>>) => void;
  reset: () => void;
};

const initialState = {
  inventory: [] as GearInstance[],
  loadouts: createEmptyGearLoadouts(),
  boardPositions: {} as GearBoardPositions,
  equippedReturnPositions: {} as GearBoardPositions,
  currencyBoardPositions: {} as CraftingCurrencyBoardPositions,
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

export const useGearStore = create<GearStore>((set, get) => ({
  ...initialState,
  initialize: (
    inventory,
    loadouts,
    boardPositions = {},
    craftingCurrencies = initialState.craftingCurrencies,
    equippedReturnPositions = {},
    currencyBoardPositions = {},
  ) => {
    const legacy = Object.keys(boardPositions).length === 0 ? readLegacyBoardPositions() : {};
    const merged = { ...legacy, ...boardPositions };
    const inventoryIds = new Set(inventory.map((item) => item.instanceId));
    const nextReturn: GearBoardPositions = {};
    for (const [instanceId, position] of Object.entries(equippedReturnPositions)) {
      if (inventoryIds.has(instanceId)) nextReturn[instanceId] = position;
    }
    const normalizedCurrencies = normalizeCraftingCurrencies(craftingCurrencies);
    set({
      inventory,
      loadouts,
      boardPositions: sanitizeGearBoardPositions(merged, inventory),
      equippedReturnPositions: nextReturn,
      craftingCurrencies: normalizedCurrencies,
      currencyBoardPositions: sanitizeCurrencyBoardPositions(currencyBoardPositions, normalizedCurrencies),
    });
  },
  addInstance: (instance) => set((state) => ({ inventory: [...state.inventory, instance] })),
  equip: (characterId, slot, instance, options) =>
    set((state) => {
      const displacedId = state.loadouts[characterId]?.[slot] ?? null;
      const nextLoadouts = equipGear(state.loadouts, characterId, slot, instance, state.inventory);
      const nextPositions = { ...state.boardPositions };
      const nextReturn = { ...state.equippedReturnPositions };

      if (options?.vacatedPlacement) {
        const currentPos = nextPositions[instance.instanceId];
        if (currentPos) {
          nextReturn[instance.instanceId] = currentPos;
          delete nextPositions[instance.instanceId];
        }
        if (options.swapDisplaced !== false && displacedId && displacedId !== instance.instanceId) {
          nextPositions[displacedId] = options.vacatedPlacement;
        }
      }

      return {
        loadouts: nextLoadouts,
        boardPositions: sanitizeGearBoardPositions(nextPositions, state.inventory),
        equippedReturnPositions: nextReturn,
      };
    }),
  unequip: (characterId, slot) =>
    set((state) => {
      const instanceId = state.loadouts[characterId]?.[slot];
      const nextLoadouts = unequipGear(state.loadouts, characterId, slot);
      const nextPositions = { ...state.boardPositions };
      const nextReturn = { ...state.equippedReturnPositions };
      if (instanceId && nextReturn[instanceId]) {
        nextPositions[instanceId] = nextReturn[instanceId];
        delete nextReturn[instanceId];
      }
      return {
        loadouts: nextLoadouts,
        boardPositions: sanitizeGearBoardPositions(nextPositions, state.inventory),
        equippedReturnPositions: nextReturn,
      };
    }),
  setBoardPosition: (instanceId, col, row) =>
    set((state) => ({
      boardPositions: { ...state.boardPositions, [instanceId]: { col, row } },
    })),
  setCurrencyBoardPosition: (currencyId, col, row) =>
    set((state) => ({
      currencyBoardPositions: { ...state.currencyBoardPositions, [currencyId]: { col, row } },
    })),
  syncBoardPositions: () =>
    set((state) => {
      const nextBoardPositions = sanitizeGearBoardPositions(state.boardPositions, state.inventory);
      const nextCurrencyPositions = sanitizeCurrencyBoardPositions(
        state.currencyBoardPositions,
        state.craftingCurrencies,
      );
      if (
        boardPositionsEqual(state.boardPositions, nextBoardPositions) &&
        boardPositionsEqual(state.currencyBoardPositions, nextCurrencyPositions)
      ) {
        return state;
      }
      return { boardPositions: nextBoardPositions, currencyBoardPositions: nextCurrencyPositions };
    }),
  salvage: (instanceId, options) => {
    const result = salvageGear(get().inventory, get().loadouts, instanceId, options?.rng);
    if (result) {
      const nextPositions = { ...get().boardPositions };
      const nextReturn = { ...get().equippedReturnPositions };
      delete nextPositions[instanceId];
      delete nextReturn[instanceId];

      const nextCurrencies = addCraftingCurrencies(get().craftingCurrencies, result.yieldedCurrencies);

      set({
        inventory: result.inventory,
        loadouts: result.loadouts,
        boardPositions: sanitizeGearBoardPositions(nextPositions, result.inventory),
        equippedReturnPositions: nextReturn,
        craftingCurrencies: nextCurrencies,
        currencyBoardPositions: sanitizeCurrencyBoardPositions(get().currencyBoardPositions, nextCurrencies),
      });
      return { inventory: result.inventory, yieldedCurrencies: result.yieldedCurrencies };
    }
    return null;
  },
  applyCurrency: (currencyId, instanceId, options) => {
    const item = get().inventory.find((i) => i.instanceId === instanceId);
    if (!item) return false;
    if ((get().craftingCurrencies[currencyId] ?? 0) < 1) return false;
    if (!canApplyCraftingCurrency(currencyId, item)) return false;

    const updatedItem = applyCraftingCurrency(currencyId, item, options?.rng);
    const nextInventory = get().inventory.map((i) => (i.instanceId === instanceId ? updatedItem : i));
    const nextCurrencies = normalizeCraftingCurrencies({
      ...get().craftingCurrencies,
      [currencyId]: (get().craftingCurrencies[currencyId] ?? 0) - 1,
    });

    set({
      inventory: nextInventory,
      craftingCurrencies: nextCurrencies,
      currencyBoardPositions: sanitizeCurrencyBoardPositions(get().currencyBoardPositions, nextCurrencies),
    });
    return true;
  },
  addCurrencies: (currencies) =>
    set((state) => {
      const nextCurrencies = addCraftingCurrencies(state.craftingCurrencies, currencies);
      return {
        craftingCurrencies: nextCurrencies,
        currencyBoardPositions: sanitizeCurrencyBoardPositions(state.currencyBoardPositions, nextCurrencies),
      };
    }),
  reset: () => set(initialState),
}));
