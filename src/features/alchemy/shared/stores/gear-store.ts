import type { CharacterId } from "@/lib/game-data";
import { trinketLibrary } from "@/lib/game-data";
import { useMemo } from "react";
import {
  computeGearManifest,
  createEmptyEquippedTrinkets,
  createEmptyGearInventories,
  createEmptyGearLoadouts,
  EMPTY_CRAFTING_CURRENCIES,
  flattenGearInventories,
} from "@/lib/gear";
import { useShallow } from "zustand/react/shallow";
import type { PersistenceCodec } from "./persistence-codec";
import type { GearSaveFields, GearStore } from "./gear-store-types";
import { initializeGear } from "./gear-actions";
import { readGameplayState, subscribeGameplayCommits, useGameplayStateStore } from "./gameplay-state-store";
import type { GameplayDraft } from "./run-session-command";

export type { GearSaveFields } from "./gear-store-types";

export const gearPersistenceCodec: PersistenceCodec<GearSaveFields, [draft: GameplayDraft]> = {
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
      gearInventories: state.inventories,
      gearLoadouts: state.loadouts,
      ownedTrinketIds: state.ownedTrinketIds,
      equippedTrinkets: state.equippedTrinkets,
      craftingCurrencies: state.craftingCurrencies,
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
  subscribe: (listener) => subscribeGameplayCommits(() => listener()),
};

export type GearArmorySlice = Pick<
  GearStore,
  "inventories" | "loadouts" | "ownedTrinketIds" | "equippedTrinkets" | "craftingCurrencies"
>;

/** Canonical gear read/command slice for feature controllers. */
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

/** Aggregate gear effects for a character at battle/run-start entry. */
export function readGearManifestForCharacter(characterId: CharacterId) {
  const { inventories, loadouts } = readGameplayState().gear;
  return computeGearManifest(characterId, flattenGearInventories(inventories), loadouts);
}

export function readGearMaxHealthBonus(characterId: CharacterId): number {
  return readGearManifestForCharacter(characterId).maxHealth;
}

export function readEquippedTrinketId(characterId: CharacterId): string | null {
  return readGameplayState().gear.equippedTrinkets[characterId];
}
