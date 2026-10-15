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

export const gearPersistenceCodec: GameplayPersistenceCodec<GearSaveFields> = {
  createDefault: createDefaultGearSaveFields,
  encode: (gameSession: GameSession) => {
    const state = readGameplayState(gameSession).gear;
    return structuredClone({
      gearInventories: state.inventories,
      gearLoadouts: state.loadouts,
      ownedTrinketIds: state.ownedTrinketIds,
      equippedTrinkets: state.equippedTrinkets,
      craftingCurrencies: state.craftingCurrencies,
    });
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

export function readGearState(gameSession: GameSession): Readonly<GearStateFields> {
  return readGameplayState(gameSession).gear;
}

export function readEquippedTrinketId(characterId: CharacterId, gameSession: GameSession): string | null {
  return readGameplayState(gameSession).gear.equippedTrinkets[characterId];
}
