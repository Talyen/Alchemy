import type { CharacterId } from "@/lib/game-data";
import {
  type GearBoardPositions,
  type GearBoardPositionsByCharacter,
  type GearLoadouts,
  GEAR_CHARACTER_IDS,
} from "./types";
import type { CraftingCurrencyBoardPositions, CraftingCurrencyBoardPositionsByCharacter } from "./crafting";
import { buildArmoryBoardView } from "./board-view";
import type { BoardSourceState } from "./store-state";

export type PositionRegistry = Record<string, { col: number; row: number }>;
export type CharacterPositionRegistry = Record<CharacterId, PositionRegistry>;

export function positionsEqual(left: PositionRegistry, right: PositionRegistry): boolean {
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) return false;
  return leftKeys.every((k) => left[k]?.col === right[k]?.col && left[k]?.row === right[k]?.row);
}

export function positionsByCharacterEqual(left: CharacterPositionRegistry, right: CharacterPositionRegistry): boolean {
  return Object.keys(left).every((charId) => positionsEqual(left[charId as CharacterId], right[charId as CharacterId]));
}

export function omitGearPosition(positions: GearBoardPositions, instanceId: string): GearBoardPositions {
  return Object.fromEntries(Object.entries(positions).filter(([id]) => id !== instanceId));
}

export function syncBoardPositionsForState(state: BoardSourceState): {
  boardPositionsByCharacter: GearBoardPositionsByCharacter;
  currencyBoardPositionsByCharacter: CraftingCurrencyBoardPositionsByCharacter;
} {
  let changed = false;
  const nextBoardPositionsByCharacter = { ...state.boardPositionsByCharacter };
  const nextCurrencyPositionsByCharacter = { ...state.currencyBoardPositionsByCharacter };

  for (const characterId of GEAR_CHARACTER_IDS) {
    const gearPositions = state.boardPositionsByCharacter[characterId];
    const currencyPositions = state.currencyBoardPositionsByCharacter[characterId];

    const boardView = buildArmoryBoardView({
      inventory: state.inventories[characterId],
      loadout: state.loadouts[characterId],
      gearPositions,
      currencyPositions,
      craftingCurrencies: state.craftingCurrencies,
    });

    const nextGearForChar: GearBoardPositions = {};
    for (const packed of boardView.packedInventory.items) {
      nextGearForChar[packed.item.instanceId] = { col: packed.col, row: packed.row };
    }

    const nextCurrencyForChar: CraftingCurrencyBoardPositions = {};
    for (const packed of boardView.packedCurrencies) {
      nextCurrencyForChar[packed.currencyId] = { col: packed.col, row: packed.row };
    }

    const prevGearKeys = Object.keys(gearPositions).sort();
    const nextGearKeys = Object.keys(nextGearForChar).sort();
    if (nextGearKeys.join("|") !== prevGearKeys.join("|")) changed = true;

    const prevCurrencyKeys = Object.keys(currencyPositions).sort();
    const nextCurrencyKeys = Object.keys(nextCurrencyForChar).sort();
    if (nextCurrencyKeys.join("|") !== prevCurrencyKeys.join("|")) changed = true;

    nextBoardPositionsByCharacter[characterId] = nextGearForChar;
    nextCurrencyPositionsByCharacter[characterId] = nextCurrencyForChar;
  }

  if (
    !changed &&
    positionsByCharacterEqual(state.boardPositionsByCharacter, nextBoardPositionsByCharacter) &&
    positionsByCharacterEqual(state.currencyBoardPositionsByCharacter, nextCurrencyPositionsByCharacter)
  ) {
    return {
      boardPositionsByCharacter: state.boardPositionsByCharacter,
      currencyBoardPositionsByCharacter: state.currencyBoardPositionsByCharacter,
    };
  }

  return {
    boardPositionsByCharacter: nextBoardPositionsByCharacter,
    currencyBoardPositionsByCharacter: nextCurrencyPositionsByCharacter,
  };
}

function moveEquippedOffBoard(
  loadouts: GearLoadouts,
  boardPositionsByCharacter: GearBoardPositionsByCharacter,
): GearBoardPositionsByCharacter {
  const nextBoardPositionsByCharacter = { ...boardPositionsByCharacter };

  for (const characterId of GEAR_CHARACTER_IDS) {
    const loadout = loadouts[characterId];
    const equippedIds = new Set(Object.values(loadout).filter(Boolean) as string[]);
    const gearPositions = nextBoardPositionsByCharacter[characterId];
    let cleanGearPositions = gearPositions;
    let modified = false;
    for (const instanceId of Object.keys(gearPositions)) {
      if (equippedIds.has(instanceId)) {
        cleanGearPositions = omitGearPosition(cleanGearPositions, instanceId);
        modified = true;
      }
    }
    if (modified) {
      nextBoardPositionsByCharacter[characterId] = cleanGearPositions;
    }
  }

  return nextBoardPositionsByCharacter;
}

function keepUnchangedIfEqual<T>(current: T, next: T, equal: (a: T, b: T) => boolean): T {
  return equal(current, next) ? current : next;
}

export function updateGearStateAndSync<T extends BoardSourceState>(state: T, updates: Partial<T>): T {
  const merged = { ...state, ...updates };

  const boardPositionsWithoutEquipped = moveEquippedOffBoard(merged.loadouts, merged.boardPositionsByCharacter);

  const synced = syncBoardPositionsForState({
    ...merged,
    boardPositionsByCharacter: boardPositionsWithoutEquipped,
  });

  const finalGear = keepUnchangedIfEqual(
    state.boardPositionsByCharacter,
    synced.boardPositionsByCharacter,
    positionsByCharacterEqual,
  );
  const finalCurrency = keepUnchangedIfEqual(
    state.currencyBoardPositionsByCharacter,
    synced.currencyBoardPositionsByCharacter,
    positionsByCharacterEqual,
  );

  return {
    ...merged,
    boardPositionsByCharacter: finalGear,
    currencyBoardPositionsByCharacter: finalCurrency,
  };
}
