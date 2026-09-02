import type { CharacterId } from "@/lib/game-data";
import { trinketLibrary } from "@/lib/game-data";
import { useMemo } from "react";
import {
  createEmptyEquippedTrinkets,
  createEmptyGearInventories,
  createEmptyGearLoadouts,
  EMPTY_CRAFTING_CURRENCIES,
  flattenGearInventories,
} from "@/lib/gear";
import { useShallow } from "zustand/react/shallow";
import { type GameplayPersistenceCodec } from "./persistence-codec";
import type { GearSaveFields, GearStateFields, GearStore } from "./gear-store-types";
import { initializeGear } from "./gear-actions";
import { readGameplayState, useGameplayStateStore } from "./gameplay-state-store";

export type { GearSaveFields } from "./gear-store-types";

function cloneGearInventories(inventories: GearSaveFields["gearInventories"]): GearSaveFields["gearInventories"] {
  return Object.fromEntries(
    Object.entries(inventories).map(([characterId, instances]) => [
      characterId,
      instances.map((instance) => ({
        ...instance,
        affixes: instance.affixes.map((affix) => ({ ...affix })),
      })),
    ]),
  ) as GearSaveFields["gearInventories"];
}

function cloneGearLoadouts(loadouts: GearSaveFields["gearLoadouts"]): GearSaveFields["gearLoadouts"] {
  return Object.fromEntries(
    Object.entries(loadouts).map(([characterId, loadout]) => [characterId, { ...loadout }]),
  ) as GearSaveFields["gearLoadouts"];
}

export const gearPersistenceCodec: GameplayPersistenceCodec<GearSaveFields> = {
  createDefault: () => ({
    gearInventories: createEmptyGearInventories(),
    gearLoadouts: createEmptyGearLoadouts(),
    ownedTrinketIds: [],
    equippedTrinkets: createEmptyEquippedTrinkets(),
    craftingCurrencies: { ...EMPTY_CRAFTING_CURRENCIES },
  }),
  encode: () => {
    const state = readGameplayState().gear;
    return {
      gearInventories: cloneGearInventories(state.inventories),
      gearLoadouts: cloneGearLoadouts(state.loadouts),
      ownedTrinketIds: [...state.ownedTrinketIds],
      equippedTrinkets: { ...state.equippedTrinkets },
      craftingCurrencies: { ...state.craftingCurrencies },
    };
  },
  hydrate: (fields, draft) => {
    initializeGear(
      draft.gear,
      fields.gearInventories,
      fields.gearLoadouts,
      fields.craftingCurrencies,
      fields.ownedTrinketIds,
      fields.equippedTrinkets,
    );
  },
};

export type GearArmorySlice = Pick<
  GearStore,
  "inventories" | "loadouts" | "ownedTrinketIds" | "equippedTrinkets" | "craftingCurrencies"
>;

export function useGearArmorySlice(): GearArmorySlice {
  return useGameplayStateStore(
    useShallow((state) => ({
      inventories: state.gear.inventories,
      loadouts: state.gear.loadouts,
      ownedTrinketIds: state.gear.ownedTrinketIds,
      equippedTrinkets: state.gear.equippedTrinkets,
      craftingCurrencies: state.gear.craftingCurrencies,
    })),
  );
}

export function readHasAnyOwnedGear(): boolean {
  const gear = readGameplayState().gear;
  return flattenGearInventories(gear.inventories).length > 0 || gear.ownedTrinketIds.length > 0;
}

export function readGearState(): GearStateFields {
  const gear = readGameplayState().gear;
  return {
    inventories: gear.inventories,
    loadouts: gear.loadouts,
    ownedTrinketIds: gear.ownedTrinketIds,
    equippedTrinkets: gear.equippedTrinkets,
    craftingCurrencies: gear.craftingCurrencies,
  };
}

export function readHasUnownedTrinkets(): boolean {
  return readGameplayState().gear.ownedTrinketIds.length < trinketLibrary.length;
}

function useHasAnyOwnedGear(): boolean {
  const { inventories, ownedTrinketIds } = useGameplayStateStore(
    useShallow((state) => ({ inventories: state.gear.inventories, ownedTrinketIds: state.gear.ownedTrinketIds })),
  );
  return useMemo(
    () => flattenGearInventories(inventories).length > 0 || ownedTrinketIds.length > 0,
    [inventories, ownedTrinketIds],
  );
}

export function useIsArmoryLocked(): boolean {
  return !useHasAnyOwnedGear();
}

export function readEquippedTrinketId(characterId: CharacterId): string | null {
  return readGameplayState().gear.equippedTrinkets[characterId];
}
