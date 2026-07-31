import type { PersistenceCodec } from "./persistence-codec";
import type { GearSaveFields, GearStore } from "./gear-store-types";
import { createSliceStore } from "./slice-store-adapter";
import type { GameplayState } from "./gameplay-state-store";
import {
  createEmptyCurrencyBoardPositionsByCharacter,
  createEmptyGearBoardPositionsByCharacter,
  createEmptyGearInventories,
  createEmptyGearLoadouts,
  EMPTY_CRAFTING_CURRENCIES,
} from "@/lib/gear";

export type { GearSaveFields, GearStore } from "./gear-store-types";

const GEAR_KEYS = [
  "inventories",
  "loadouts",
  "boardPositionsByCharacter",
  "currencyBoardPositionsByCharacter",
  "craftingCurrencies",
  "initialize",
  "addInstance",
  "transferToInventory",
  "equip",
  "unequip",
  "moveBoardItem",
  "syncBoardPositions",
  "sortBoard",
  "salvage",
  "applyCurrency",
  "addCurrencies",
  "reset",
] as const satisfies ReadonlyArray<keyof GearStore>;

const gearActionKeyMap = {
  initialize: "gearInitialize",
  addInstance: "gearAddInstance",
  transferToInventory: "gearTransferToInventory",
  equip: "gearEquip",
  unequip: "gearUnequip",
  moveBoardItem: "gearMoveBoardItem",
  syncBoardPositions: "gearSyncBoardPositions",
  sortBoard: "gearSortBoard",
  salvage: "gearSalvage",
  applyCurrency: "gearApplyCurrency",
  addCurrencies: "gearAddCurrencies",
  reset: "gearReset",
} as const satisfies Partial<Record<keyof GearStore, keyof GameplayState>>;

function pickGearStore(state: GameplayState): GearStore {
  return {
    inventories: state.inventories,
    loadouts: state.loadouts,
    boardPositionsByCharacter: state.boardPositionsByCharacter,
    currencyBoardPositionsByCharacter: state.currencyBoardPositionsByCharacter,
    craftingCurrencies: state.craftingCurrencies,
    initialize: state.gearInitialize,
    addInstance: state.gearAddInstance,
    transferToInventory: state.gearTransferToInventory,
    equip: state.gearEquip,
    unequip: state.gearUnequip,
    moveBoardItem: state.gearMoveBoardItem,
    syncBoardPositions: state.gearSyncBoardPositions,
    sortBoard: state.gearSortBoard,
    salvage: state.gearSalvage,
    applyCurrency: state.gearApplyCurrency,
    addCurrencies: state.gearAddCurrencies,
    reset: state.gearReset,
  };
}

export const useGearStore = createSliceStore<GearStore>(pickGearStore, GEAR_KEYS, gearActionKeyMap);

export const gearPersistenceCodec: PersistenceCodec<GearSaveFields> = {
  createDefault: () => ({
    gearInventories: createEmptyGearInventories(),
    gearLoadouts: createEmptyGearLoadouts(),
    gearBoardPositionsByCharacter: createEmptyGearBoardPositionsByCharacter(),
    craftingCurrencyBoardPositionsByCharacter: createEmptyCurrencyBoardPositionsByCharacter(),
    craftingCurrencies: { ...EMPTY_CRAFTING_CURRENCIES },
  }),
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
  hydrate: (fields) =>
    useGearStore
      .getState()
      .initialize(
        fields.gearInventories,
        fields.gearLoadouts,
        fields.gearBoardPositionsByCharacter,
        fields.craftingCurrencies,
        fields.craftingCurrencyBoardPositionsByCharacter,
      ),
  subscribe: (listener) => useGearStore.subscribe(() => listener()),
};
