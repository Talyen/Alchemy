import type { CharacterId } from "@/lib/game-data";
import {
  computeGearManifest,
  createEmptyCurrencyBoardPositionsByCharacter,
  createEmptyGearBoardPositionsByCharacter,
  createEmptyGearInventories,
  createEmptyGearLoadouts,
  EMPTY_CRAFTING_CURRENCIES,
  flattenGearInventories,
} from "@/lib/gear";
import { useShallow } from "zustand/react/shallow";
import type { PersistenceCodec } from "./persistence-codec";
import type { GearSaveFields, GearStore } from "./gear-store-types";
import {
  applyGameplayStateUpdate,
  readGameplayState,
  subscribeGameplayCommits,
  useGameplayStateStore,
  type GameplayState,
} from "./gameplay-state-store";

export type { GearSaveFields } from "./gear-store-types";

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

interface GearStoreHook {
  <U = GearStore>(selector?: (state: GearStore) => U): U;
  getState: () => GearStore;
  getInitialState: () => GearStore;
  setState: (partial: Partial<GearStore> | ((state: GearStore) => Partial<GearStore> | void)) => void;
  subscribe: (listener: (state: GearStore, previousState: GearStore) => void) => () => void;
}

const useGearStoreHook = ((selector?: (state: GearStore) => unknown) =>
  useGameplayStateStore((state) => {
    const slice = pickGearStore(state);
    return selector ? selector(slice) : slice;
  })) as GearStoreHook;

useGearStoreHook.getState = () => pickGearStore(readGameplayState());
useGearStoreHook.getInitialState = () => pickGearStore(useGameplayStateStore.getInitialState());
useGearStoreHook.setState = (partial) => {
  applyGameplayStateUpdate((state) => {
    const slice = pickGearStore(state);
    const next = typeof partial === "function" ? partial(slice) : partial;
    if (!next || typeof next !== "object") return;
    if (next.inventories !== undefined) state.gear.inventories = next.inventories;
    if (next.loadouts !== undefined) state.gear.loadouts = next.loadouts;
    if (next.boardPositionsByCharacter !== undefined)
      state.gear.boardPositionsByCharacter = next.boardPositionsByCharacter;
    if (next.currencyBoardPositionsByCharacter !== undefined)
      state.gear.currencyBoardPositionsByCharacter = next.currencyBoardPositionsByCharacter;
    if (next.craftingCurrencies !== undefined) state.gear.craftingCurrencies = next.craftingCurrencies;
  });
};
useGearStoreHook.subscribe = (listener) =>
  useGameplayStateStore.subscribe((state, previousState) =>
    listener(pickGearStore(state), pickGearStore(previousState)),
  );

export const useGearStore = useGearStoreHook;

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

export type GearArmorySlice = Pick<
  GearStore,
  | "inventories"
  | "loadouts"
  | "boardPositionsByCharacter"
  | "currencyBoardPositionsByCharacter"
  | "craftingCurrencies"
  | "addInstance"
  | "moveBoardItem"
  | "sortBoard"
>;

/** Canonical gear read/command slice for feature controllers. */
export function useGearArmorySlice(): GearArmorySlice {
  return useGameplayStateStore(
    useShallow((state) => ({
      inventories: state.gear.inventories,
      loadouts: state.gear.loadouts,
      boardPositionsByCharacter: state.gear.boardPositionsByCharacter,
      currencyBoardPositionsByCharacter: state.gear.currencyBoardPositionsByCharacter,
      craftingCurrencies: state.gear.craftingCurrencies,
      addInstance: state.gearActions.gearAddInstance,
      moveBoardItem: state.gearActions.gearMoveBoardItem,
      sortBoard: state.gearActions.gearSortBoard,
    })),
  );
}

export function readHasAnyOwnedGear(): boolean {
  return flattenGearInventories(readGameplayState().gear.inventories).length > 0;
}

export function useHasAnyOwnedGear(): boolean {
  return useGameplayStateStore((state) => flattenGearInventories(state.gear.inventories).length > 0);
}

/** Aggregate gear effects for a character at battle/run-start entry. */
export function readGearManifestForCharacter(characterId: CharacterId) {
  const { inventories, loadouts } = readGameplayState().gear;
  return computeGearManifest(characterId, flattenGearInventories(inventories), loadouts);
}

export function readGearMaxHealthBonus(characterId: CharacterId): number {
  return readGearManifestForCharacter(characterId).maxHealth;
}
