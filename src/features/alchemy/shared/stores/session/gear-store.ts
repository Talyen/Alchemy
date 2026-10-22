import type { Immutable } from "immer";
import type { CharacterId } from "@/lib/game-data";
import { trinketLibrary } from "@/lib/game-data";
import { GEAR_CHARACTER_IDS } from "@/lib/gear";
import type { GameSession } from "./game-session-types";
import { readGameplayState } from "./gameplay-state-reads";
import type { GearStateFields } from "./gear-store-types";
export type { GearCombatRestrictions } from "./gear-combat-restrictions";

export type { GearSaveFields } from "./gear-store-types";

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
