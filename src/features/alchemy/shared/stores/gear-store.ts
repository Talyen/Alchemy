import type { CharacterId } from "@/lib/game-data";
import { trinketLibrary } from "@/lib/game-data";
import { GEAR_CHARACTER_IDS } from "@/lib/gear";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { defaultGameSession } from "./default-game-session";
import type { GameSession } from "./game-session-types";
import { readGameplayState, useGameplayStateStore } from "./gameplay-state-store";
import { createDefaultGearSaveFields, initializeGear } from "./gear-actions";
import { deriveGearCombatRestrictions } from "./gear-combat-restrictions";
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
  encode: (gameSession: GameSession = defaultGameSession) => {
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

export function useGearCombatRestrictions() {
  const selection = useGameplayStateStore(
    useShallow((s) => ({
      activityKind: s.session.activity.kind,
      characterId: s.run.activeRun.characterId,
      contentSystemType: s.run.activeRun.contentSystemType,
      hasActiveBattle: s.battle.hasActiveBattle,
      loadouts: s.gear.loadouts,
      equippedTrinkets: s.gear.equippedTrinkets,
    })),
  );
  return useMemo(
    () =>
      deriveGearCombatRestrictions({
        session: { activity: { kind: selection.activityKind } },
        run: { activeRun: { characterId: selection.characterId, contentSystemType: selection.contentSystemType } },
        battle: { hasActiveBattle: selection.hasActiveBattle },
        gear: { loadouts: selection.loadouts, equippedTrinkets: selection.equippedTrinkets },
      }),
    [selection],
  );
}

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

function hasAnyOwnedGear(inventories: GearStateFields["inventories"], ownedTrinketIds: string[]): boolean {
  return ownedTrinketIds.length > 0 || GEAR_CHARACTER_IDS.some((id) => inventories[id].length > 0);
}

export function readHasAnyOwnedGear(gameSession: GameSession = defaultGameSession): boolean {
  const gear = readGameplayState(gameSession).gear;
  return hasAnyOwnedGear(gear.inventories, gear.ownedTrinketIds);
}

export function readGearState(gameSession: GameSession = defaultGameSession): GearStateFields {
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

export function readHasUnownedTrinkets(gameSession: GameSession = defaultGameSession): boolean {
  return readGameplayState(gameSession).gear.ownedTrinketIds.length < trinketLibrary.length;
}

export function readEquippedTrinketId(
  characterId: CharacterId,
  gameSession: GameSession = defaultGameSession,
): string | null {
  return readGameplayState(gameSession).gear.equippedTrinkets[characterId];
}
