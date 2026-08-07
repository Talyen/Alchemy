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
import { readGameplayState, subscribeGameplayCommits, useGameplayStateStore } from "./gameplay-state-store";

export type { GearSaveFields } from "./gear-store-types";

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
