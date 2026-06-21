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
  type CraftingCurrencyBoardPositionsByCharacter,
  canApplyCraftingCurrency,
  applyCraftingCurrency,
  EMPTY_CRAFTING_CURRENCIES,
  addCraftingCurrencies,
  normalizeCraftingCurrencies,
  GEAR_CHARACTER_IDS,
  GEAR_SLOTS,
  type BoardItemRef,
  updateGearStateAndSync,
  moveBoardItemForState,
  sortBoardForCharacter,
} from "@/lib/gear";

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
  sortBoard: (characterId: CharacterId) => void;
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

      const currentPos = characterPositions[instance.instanceId];
      if (currentPos) {
        nextReturn[instance.instanceId] = currentPos;
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- imperative object-based registry
        delete characterPositions[instance.instanceId];
      }

      if (options?.vacatedPlacement) {
        if (options.swapDisplaced !== false && displacedId && displacedId !== instance.instanceId) {
          characterPositions[displacedId] = options.vacatedPlacement;
          delete nextReturn[instance.instanceId];
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
  sortBoard: (characterId) =>
    set((state) => {
      const { gearPositions, currencyPositions } = sortBoardForCharacter(state, characterId);
      return updateGearStateAndSync(state, {
        boardPositionsByCharacter: {
          ...state.boardPositionsByCharacter,
          [characterId]: gearPositions,
        },
        currencyBoardPositionsByCharacter: {
          ...state.currencyBoardPositionsByCharacter,
          [characterId]: currencyPositions,
        },
      });
    }),
  salvage: (instanceId, options) => {
    const state = get();
    const owner = findGearInventoryOwner(state.inventories, instanceId);
    if (!owner) return null;

    const rng = options?.rng;
    if (!rng) throw new Error("salvage requires an explicit rng");
    const flatInventory = flattenGearInventories(state.inventories);
    const result = salvageGear(flatInventory, state.loadouts, instanceId, rng);
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

    const rng = options?.rng;
    if (!rng) throw new Error("applyCurrency requires an explicit rng");
    const updatedItem = applyCraftingCurrency(currencyId, item, rng);
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
