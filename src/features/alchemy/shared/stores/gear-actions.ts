import type { CharacterId } from "@/lib/game-data";
import {
  createEmptyGearBoardPositionsByCharacter,
  createEmptyCurrencyBoardPositionsByCharacter,
  equipGear,
  flattenGearInventories,
  findGearInventoryOwner,
  salvageGear,
  unequipGear,
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
  omitGearPosition,
  positionsByCharacterEqual,
  EMPTY_CRAFTING_CURRENCIES,
} from "@/lib/gear";
import type { GearStore } from "./gear-store-types";
import { initialState } from "./gear-store-initial-state";

export type GearStateFields = Pick<
  GearStore,
  "inventories" | "loadouts" | "boardPositionsByCharacter" | "currencyBoardPositionsByCharacter" | "craftingCurrencies"
>;
export type GearActions = Omit<GearStore, keyof GearStateFields>;

type SetState = (partial: Partial<GearStateFields> | ((state: GearStateFields) => unknown), replace?: boolean) => void;
type GetState = () => GearStateFields;

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
    nextPositions[currentOwner] = omitGearPosition(nextPositions[currentOwner], instanceId);
  }
  const movedInstance = inventories[currentOwner].find((item) => item.instanceId === instanceId);
  if (!movedInstance) return { movedInventories: inventories, clearedPositions: nextPositions };
  return {
    movedInventories: {
      ...inventories,
      [currentOwner]: inventories[currentOwner].filter((item) => item.instanceId !== instanceId),
      [targetCharacterId]: [...(inventories[targetCharacterId] ?? []), movedInstance],
    },
    clearedPositions: nextPositions,
  };
}

export function createGearActions(set: SetState, get: GetState): GearActions {
  return {
    initialize: (
      inventories,
      loadouts,
      boardPositionsByCharacter = createEmptyGearBoardPositionsByCharacter(),
      craftingCurrencies = initialState.craftingCurrencies,
      currencyBoardPositionsByCharacter = createEmptyCurrencyBoardPositionsByCharacter(),
    ) => {
      set(() => {
        const current = get();
        return updateGearStateAndSync(
          {
            inventories: current.inventories,
            loadouts: current.loadouts,
            boardPositionsByCharacter: current.boardPositionsByCharacter,
            currencyBoardPositionsByCharacter: current.currencyBoardPositionsByCharacter,
            craftingCurrencies: current.craftingCurrencies,
          },
          {
            inventories,
            loadouts,
            boardPositionsByCharacter,
            craftingCurrencies: normalizeCraftingCurrencies(craftingCurrencies),
            currencyBoardPositionsByCharacter,
          },
        );
      });
    },
    addInstance: (instance, characterId) =>
      set((state) => {
        const nextInventories = {
          ...state.inventories,
          [characterId]: [...(state.inventories[characterId] ?? []), instance],
        };
        Object.assign(state, updateGearStateAndSync(state, { inventories: nextInventories }));
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
      if (transferPosition) targetPositions[instanceId] = transferPosition;
      nextPositionsByCharacter[owner] = omitGearPosition(ownerPositions, instanceId);
      nextPositionsByCharacter[targetCharacterId] = targetPositions;
      set(() =>
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
        if (characterPositions[instance.instanceId])
          nextCharacterPositions = omitGearPosition(characterPositions, instance.instanceId);
        if (
          options?.vacatedPlacement &&
          options.swapDisplaced !== false &&
          displacedId &&
          displacedId !== instance.instanceId
        ) {
          nextCharacterPositions[displacedId] = options.vacatedPlacement;
        }
        const nextPositionsByCharacter = { ...clearedPositions, [characterId]: nextCharacterPositions };
        Object.assign(
          state,
          updateGearStateAndSync(state, {
            inventories: movedInventories,
            loadouts: nextLoadouts,
            boardPositionsByCharacter: nextPositionsByCharacter,
          }),
        );
      }),
    unequip: (characterId, slot) =>
      set((state) => {
        Object.assign(
          state,
          updateGearStateAndSync(state, {
            loadouts: unequipGear(state.loadouts, characterId, slot),
          }),
        );
      }),
    moveBoardItem: (characterId, item, col, row) => {
      const before = get();
      set((state) => Object.assign(state, moveBoardItemForState(state, characterId, item, col, row)));
      const after = get();
      return (
        !positionsByCharacterEqual(before.boardPositionsByCharacter, after.boardPositionsByCharacter) ||
        !positionsByCharacterEqual(before.currencyBoardPositionsByCharacter, after.currencyBoardPositionsByCharacter)
      );
    },
    syncBoardPositions: () => set((state) => Object.assign(state, updateGearStateAndSync(state, {}))),
    sortBoard: (characterId) =>
      set((state) => {
        const { gearPositions, currencyPositions } = sortBoardForCharacter(state, characterId);
        Object.assign(
          state,
          updateGearStateAndSync(state, {
            boardPositionsByCharacter: { ...state.boardPositionsByCharacter, [characterId]: gearPositions },
            currencyBoardPositionsByCharacter: {
              ...state.currencyBoardPositionsByCharacter,
              [characterId]: currencyPositions,
            },
          }),
        );
      }),
    salvage: (instanceId, options) => {
      const state = get();
      const owner = findGearInventoryOwner(state.inventories, instanceId);
      if (!owner) return null;
      if (!options?.rng) throw new Error("salvage requires an explicit rng");
      const result = salvageGear(flattenGearInventories(state.inventories), state.loadouts, instanceId, options.rng);
      if (!result) return null;
      const nextPositionsByCharacter = { ...state.boardPositionsByCharacter };
      nextPositionsByCharacter[owner] = omitGearPosition({ ...(nextPositionsByCharacter[owner] ?? {}) }, instanceId);
      const nextInventories = {
        ...state.inventories,
        [owner]: state.inventories[owner].filter((item) => item.instanceId !== instanceId),
      };
      const nextCurrencies = addCraftingCurrencies(state.craftingCurrencies, result.yieldedCurrencies);
      set(() =>
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
      const item = state.inventories[owner].find((entry) => entry.instanceId === instanceId);
      if (!item || (state.craftingCurrencies[currencyId] ?? 0) < 1 || !canApplyCraftingCurrency(currencyId, item))
        return false;
      if (!options?.rng) throw new Error("applyCurrency requires an explicit rng");
      const updatedItem = applyCraftingCurrency(currencyId, item, options.rng);
      if (updatedItem === item) return false;
      const nextInventories = {
        ...state.inventories,
        [owner]: state.inventories[owner].map((entry) => (entry.instanceId === instanceId ? updatedItem : entry)),
      };
      const nextCurrencies = normalizeCraftingCurrencies({
        ...state.craftingCurrencies,
        [currencyId]: (state.craftingCurrencies[currencyId] ?? 0) - 1,
      });
      set(() =>
        updateGearStateAndSync(state, {
          inventories: nextInventories,
          craftingCurrencies: nextCurrencies,
          currencyBoardPositionsByCharacter: state.currencyBoardPositionsByCharacter,
        }),
      );
      return true;
    },
    addCurrencies: (currencies) =>
      set((state) =>
        Object.assign(
          state,
          updateGearStateAndSync(state, {
            craftingCurrencies: addCraftingCurrencies(state.craftingCurrencies, currencies),
            currencyBoardPositionsByCharacter: state.currencyBoardPositionsByCharacter,
          }),
        ),
      ),
    reset: () => set(() => ({ ...initialState, craftingCurrencies: { ...EMPTY_CRAFTING_CURRENCIES } })),
  };
}
