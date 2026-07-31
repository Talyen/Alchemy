import type { PersistenceCodec } from "./persistence-codec";
import type { GearSaveFields, GearStore } from "./gear-store-types";
import { createSliceStore } from "./slice-store-adapter";
import { readGameplayState, subscribeGameplayCommits, type GameplayState } from "./gameplay-state-store";
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
} as const satisfies Partial<Record<keyof GearStore, keyof GameplayState["gearActions"]>>;

function pickGearStore(state: GameplayState): GearStore {
  return {
    ...state.gear,
    initialize: state.gearActions.gearInitialize,
    addInstance: state.gearActions.gearAddInstance,
    transferToInventory: state.gearActions.gearTransferToInventory,
    equip: state.gearActions.gearEquip,
    unequip: state.gearActions.gearUnequip,
    moveBoardItem: state.gearActions.gearMoveBoardItem,
    syncBoardPositions: state.gearActions.gearSyncBoardPositions,
    sortBoard: state.gearActions.gearSortBoard,
    salvage: state.gearActions.gearSalvage,
    applyCurrency: state.gearActions.gearApplyCurrency,
    addCurrencies: state.gearActions.gearAddCurrencies,
    reset: state.gearActions.gearReset,
  };
}

function writeGearKey(state: GameplayState, key: keyof GearStore, value: unknown): void {
  const mappedKey = gearActionKeyMap[key as keyof typeof gearActionKeyMap];
  if (mappedKey) {
    (state.gearActions as unknown as Record<string, unknown>)[mappedKey] = value;
    return;
  }
  (state.gear as unknown as Record<string, unknown>)[String(key)] = value;
}

export const useGearStore = createSliceStore<GearStore>(pickGearStore, GEAR_KEYS, {}, writeGearKey);

export const gearPersistenceCodec: PersistenceCodec<GearSaveFields> = {
  createDefault: () => ({
    gearInventories: createEmptyGearInventories(),
    gearLoadouts: createEmptyGearLoadouts(),
    gearBoardPositionsByCharacter: createEmptyGearBoardPositionsByCharacter(),
    craftingCurrencyBoardPositionsByCharacter: createEmptyCurrencyBoardPositionsByCharacter(),
    craftingCurrencies: { ...EMPTY_CRAFTING_CURRENCIES },
  }),
  encode: () => {
    const state = readGameplayState().gear;
    return {
      gearInventories: state.inventories,
      gearLoadouts: state.loadouts,
      gearBoardPositionsByCharacter: state.boardPositionsByCharacter,
      craftingCurrencyBoardPositionsByCharacter: state.currencyBoardPositionsByCharacter,
      craftingCurrencies: state.craftingCurrencies,
    };
  },
  hydrate: (fields) =>
    readGameplayState().gearActions.gearInitialize(
      fields.gearInventories,
      fields.gearLoadouts,
      fields.gearBoardPositionsByCharacter,
      fields.craftingCurrencies,
      fields.craftingCurrencyBoardPositionsByCharacter,
    ),
  subscribe: (listener) => subscribeGameplayCommits(() => listener()),
};
