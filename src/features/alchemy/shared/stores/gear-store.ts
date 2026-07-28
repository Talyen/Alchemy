import { create } from "zustand";
import type { CharacterId } from "@/lib/game-data";
import {
  createEmptyGearBoardPositionsByCharacter,
  createEmptyCurrencyBoardPositionsByCharacter,
  equipGear,
  flattenGearInventories,
  findGearInventoryOwner,
  salvageGear,
  unequipGear,
  type GearBoardPositions,
  type GearBoardPositionsByCharacter,
  type GearInventories,
  type GearLoadouts,
  type GearSlot,
  canApplyCraftingCurrency,
  applyCraftingCurrency,
  addCraftingCurrencies,
  normalizeCraftingCurrencies,
  GEAR_CHARACTER_IDS,
  updateGearStateAndSync,
  moveBoardItemForState,
  sortBoardForCharacter,
  createEmptyGearInventories,
  createEmptyGearLoadouts,
  EMPTY_CRAFTING_CURRENCIES,
} from "@/lib/gear";
import type { GearSaveFields, GearStore } from "./gear-store-types";

import { initialState } from "./gear-store-initial-state";
import type { PersistenceCodec } from "./persistence-codec";

function boardPositionRegistriesEqual(
  left: Record<string, Record<string, { col: number; row: number } | undefined>>,
  right: Record<string, Record<string, { col: number; row: number } | undefined>>,
): boolean {
  const characterIds = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const characterId of characterIds) {
    const leftPositions = left[characterId] ?? {};
    const rightPositions = right[characterId] ?? {};
    const positionIds = new Set([...Object.keys(leftPositions), ...Object.keys(rightPositions)]);
    for (const positionId of positionIds) {
      const leftPosition = leftPositions[positionId];
      const rightPosition = rightPositions[positionId];
      if (leftPosition?.col !== rightPosition?.col || leftPosition?.row !== rightPosition?.row) return false;
    }
  }
  return true;
}

function omitGearPosition(positions: GearBoardPositions, instanceId: string): GearBoardPositions {
  return Object.fromEntries(Object.entries(positions).filter(([id]) => id !== instanceId));
}

function extractInstanceFromOtherOwner(
  inventories: GearInventories,
  positionsByCharacter: GearBoardPositionsByCharacter,
  instanceId: string,
  targetCharacterId: CharacterId,
  currentOwner: CharacterId | null,
): { movedInventories: GearInventories; clearedPositions: GearBoardPositionsByCharacter } {
  if (!currentOwner || currentOwner === targetCharacterId) {
    return { movedInventories: inventories, clearedPositions: positionsByCharacter };
  }
  const nextPositions = { ...positionsByCharacter };
  if (nextPositions[currentOwner]?.[instanceId]) {
    const ownerPositions = omitGearPosition(nextPositions[currentOwner], instanceId);
    nextPositions[currentOwner] = ownerPositions;
  }
  const movedInstance = inventories[currentOwner].find((item) => item.instanceId === instanceId);
  if (!movedInstance) {
    return { movedInventories: inventories, clearedPositions: nextPositions };
  }
  return {
    movedInventories: {
      ...inventories,
      [currentOwner]: inventories[currentOwner].filter((item) => item.instanceId !== instanceId),
      [targetCharacterId]: [...(inventories[targetCharacterId] ?? []), movedInstance],
    },
    clearedPositions: nextPositions,
  };
}

export const useGearStore = create<GearStore>((set, get) => ({
  ...initialState,
  initialize: (
    inventories,
    loadouts,
    boardPositionsByCharacter = createEmptyGearBoardPositionsByCharacter(),
    craftingCurrencies = initialState.craftingCurrencies,
    currencyBoardPositionsByCharacter = createEmptyCurrencyBoardPositionsByCharacter(),
  ) => {
    const normalizedCurrencies = normalizeCraftingCurrencies(craftingCurrencies);
    set((state) => {
      return updateGearStateAndSync(state, {
        inventories,
        loadouts,
        boardPositionsByCharacter,
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
    const transferPosition = ownerPositions[instanceId];
    const ownerPositionsWithoutInstance = omitGearPosition(ownerPositions, instanceId);
    if (transferPosition) {
      targetPositions[instanceId] = transferPosition;
    }
    nextPositionsByCharacter[owner] = ownerPositionsWithoutInstance;
    nextPositionsByCharacter[targetCharacterId] = targetPositions;

    set((state) =>
      updateGearStateAndSync(state, {
        inventories: nextInventories,
        loadouts: nextLoadouts,
        boardPositionsByCharacter: nextPositionsByCharacter,
      }),
    );
    return true;
  },
  equip: (characterId, slot, instance, options) =>
    set((state) => {
      const flatInventory = flattenGearInventories(state.inventories);
      const displacedId = state.loadouts[characterId]?.[slot] ?? null;
      const nextLoadouts = equipGear(state.loadouts, characterId, slot, instance, flatInventory);

      const currentOwner = findGearInventoryOwner(state.inventories, instance.instanceId);
      const { movedInventories, clearedPositions } = extractInstanceFromOtherOwner(
        state.inventories,
        state.boardPositionsByCharacter,
        instance.instanceId,
        characterId,
        currentOwner,
      );

      const characterPositions = { ...(clearedPositions[characterId] ?? {}) };
      let nextCharacterPositions = characterPositions;
      if (characterPositions[instance.instanceId]) {
        nextCharacterPositions = omitGearPosition(characterPositions, instance.instanceId);
      }
      if (options?.vacatedPlacement) {
        if (options.swapDisplaced !== false && displacedId && displacedId !== instance.instanceId) {
          nextCharacterPositions[displacedId] = options.vacatedPlacement;
        }
      }

      const nextPositionsByCharacter = { ...clearedPositions, [characterId]: nextCharacterPositions };
      return updateGearStateAndSync(state, {
        inventories: movedInventories,
        loadouts: nextLoadouts,
        boardPositionsByCharacter: nextPositionsByCharacter,
      });
    }),
  unequip: (characterId, slot) =>
    set((state) => {
      const nextLoadouts = unequipGear(state.loadouts, characterId, slot);
      return updateGearStateAndSync(state, {
        loadouts: nextLoadouts,
      });
    }),
  moveBoardItem: (characterId, item, col, row) => {
    const before = get();
    set((state) => moveBoardItemForState(state, characterId, item, col, row));
    const after = get();
    return (
      !boardPositionRegistriesEqual(before.boardPositionsByCharacter, after.boardPositionsByCharacter) ||
      !boardPositionRegistriesEqual(before.currencyBoardPositionsByCharacter, after.currencyBoardPositionsByCharacter)
    );
  },
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
    nextPositionsByCharacter[owner] = omitGearPosition(ownerPositions, instanceId);

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
    if (updatedItem === item) return false;
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

export function createDefaultGearSaveFields(): GearSaveFields {
  return {
    gearInventories: createEmptyGearInventories(),
    gearLoadouts: createEmptyGearLoadouts(),
    gearBoardPositionsByCharacter: createEmptyGearBoardPositionsByCharacter(),
    craftingCurrencyBoardPositionsByCharacter: createEmptyCurrencyBoardPositionsByCharacter(),
    craftingCurrencies: { ...EMPTY_CRAFTING_CURRENCIES },
  };
}

export const gearPersistenceCodec: PersistenceCodec<GearSaveFields> = {
  createDefault: createDefaultGearSaveFields,
  encode: () => {
    const state = useGearStore.getState();
    return {
      gearInventories: state.inventories,
      gearLoadouts: state.loadouts,
      gearBoardPositionsByCharacter: state.boardPositionsByCharacter,
      craftingCurrencyBoardPositionsByCharacter: state.currencyBoardPositionsByCharacter,
      craftingCurrencies: state.craftingCurrencies,
    };
  },
  hydrate: (fields) => {
    useGearStore
      .getState()
      .initialize(
        fields.gearInventories,
        fields.gearLoadouts,
        fields.gearBoardPositionsByCharacter,
        fields.craftingCurrencies,
        fields.craftingCurrencyBoardPositionsByCharacter,
      );
  },
  subscribe: (listener) => useGearStore.subscribe(listener),
};
