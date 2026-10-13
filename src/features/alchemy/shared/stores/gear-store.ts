import type { Immutable } from "immer";
import type { CharacterId } from "@/lib/game-data";
import { trinketLibrary } from "@/lib/game-data";
import { GEAR_CHARACTER_IDS } from "@/lib/gear";
import type { GameSession } from "./game-session-types";
import { readGameplayState } from "./gameplay-state-reads";
import { initializeGear } from "./gear-actions";
import { createDefaultGearSaveFields } from "./gear-state-defaults";
import type { GearSaveFields, GearStateFields } from "./gear-store-types";
import { type GameplayPersistenceCodec } from "./persistence-codec";
export type { GearCombatRestrictions } from "./gear-combat-restrictions";

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
  createDefault: createDefaultGearSaveFields,
  encode: (gameSession: GameSession) => {
    const state = readGameplayState(gameSession).gear;
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

export type GearArmorySlice = GearStateFields;

export function selectHasAnyOwnedGear(
  gear: Immutable<Pick<GearStateFields, "inventories" | "ownedTrinketIds">>,
): boolean {
  return gear.ownedTrinketIds.length > 0 || GEAR_CHARACTER_IDS.some((id) => gear.inventories[id].length > 0);
}

export function selectHasUnownedTrinkets(gear: Immutable<Pick<GearStateFields, "ownedTrinketIds">>): boolean {
  return gear.ownedTrinketIds.length < trinketLibrary.length;
}

export function readGearState(gameSession: GameSession): GearStateFields {
  // Live references (see readProfileStore): the codec clones on encode. Never
  // mutate the result outside a dispatchRunSessionCommand draft.
  const gear = readGameplayState(gameSession).gear;
  return {
    inventories: gear.inventories,
    loadouts: gear.loadouts,
    ownedTrinketIds: gear.ownedTrinketIds,
    equippedTrinkets: gear.equippedTrinkets,
    craftingCurrencies: gear.craftingCurrencies,
  };
}

export function readEquippedTrinketId(characterId: CharacterId, gameSession: GameSession): string | null {
  return readGameplayState(gameSession).gear.equippedTrinkets[characterId];
}
