// Narrow read port over gear-store for run-loop / run-setup / shell lifecycle code.
// Mutations stay on gear-store / armory controller — this port is read-only snapshots.
import type { CharacterId } from "@/lib/game-data";
import { computeGearManifest, flattenGearInventories } from "@/lib/gear";
import { useShallow } from "zustand/react/shallow";
import type { GearStore } from "./gear-store-types";
import { readGameplayState, useGameplayStateStore } from "./gameplay-state-store";

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
