import type { CharacterId } from "@/lib/game-data";
import {
  type GearBoardPositions,
  type GearBoardPositionsByCharacter,
  type GearInventories,
  type GearLoadouts,
  GEAR_CHARACTER_IDS,
} from "./types";
import { footprintForInstance } from "./footprints";
import { type BoardItem, boardItemKey, resolveMoveWithSwap } from "./board-moves";
import { packGridItems } from "./grid-packing";
import { getGearInstanceTitle } from "./item-names";

import {
  type CraftingCurrencyId,
  type CraftingCurrencyBoardPositions,
  type CraftingCurrencyBoardPositionsByCharacter,
  CRAFTING_CURRENCY_IDS,
} from "./crafting";
import { INVENTORY_COLS } from "./constants";
import { buildArmoryBoardView } from "./board-view";

export type BoardItemRef = { kind: "gear"; id: string } | { kind: "currency"; id: CraftingCurrencyId };

export interface BoardSourceState {
  inventories: GearInventories;
  loadouts: GearLoadouts;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  boardPositionsByCharacter: GearBoardPositionsByCharacter;
  currencyBoardPositionsByCharacter: CraftingCurrencyBoardPositionsByCharacter;
}

type PositionRegistry = Record<string, { col: number; row: number }>;
type CharacterPositionRegistry = Record<CharacterId, PositionRegistry>;

function positionsEqual(left: PositionRegistry, right: PositionRegistry): boolean {
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) return false;
  return leftKeys.every((k) => left[k]?.col === right[k]?.col && left[k]?.row === right[k]?.row);
}

function positionsByCharacterEqual(left: CharacterPositionRegistry, right: CharacterPositionRegistry): boolean {
  return Object.keys(left).every((charId) => positionsEqual(left[charId as CharacterId], right[charId as CharacterId]));
}

function buildBoardItemsForCharacter(state: BoardSourceState, characterId: CharacterId): BoardItem[] {
  const equippedInstanceIds = new Set(Object.values(state.loadouts[characterId]).filter(Boolean) as string[]);
  const availableInventory = state.inventories[characterId].filter((item) => !equippedInstanceIds.has(item.instanceId));
  const activeCurrencies = CRAFTING_CURRENCY_IDS.filter((id) => state.craftingCurrencies[id] > 0);
  const gearPositions = state.boardPositionsByCharacter[characterId];
  const currencyPositions = state.currencyBoardPositionsByCharacter[characterId];

  const items: BoardItem[] = [];

  for (const item of availableInventory) {
    const footprint = footprintForInstance(item);
    if (!footprint) continue;
    const position = gearPositions[item.instanceId] ?? { col: 1, row: 1 };
    items.push({ id: item.instanceId, kind: "gear", footprint, position });
  }

  for (const currencyId of activeCurrencies) {
    const position = currencyPositions[currencyId] ?? { col: 1, row: 1 };
    items.push({
      id: currencyId,
      kind: "currency",
      footprint: { w: 1, h: 1 },
      position,
    });
  }

  return items;
}

function resolveMoveItemAndSwap(
  characterId: CharacterId,
  movingItem: BoardItemRef,
  targetCol: number,
  targetRow: number,
  state: BoardSourceState,
): {
  nextGearPositions: GearBoardPositions;
  nextCurrencyPositions: CraftingCurrencyBoardPositions;
} {
  const nextGearPositions: GearBoardPositions = {
    ...state.boardPositionsByCharacter[characterId],
  };
  const nextCurrencyPositions: CraftingCurrencyBoardPositions = {
    ...state.currencyBoardPositionsByCharacter[characterId],
  };

  const boardItems = buildBoardItemsForCharacter(state, characterId);

  if (!boardItems.some((item) => item.id === movingItem.id && item.kind === movingItem.kind)) {
    return { nextGearPositions, nextCurrencyPositions };
  }

  const { positions, unchanged } = resolveMoveWithSwap(
    boardItems,
    movingItem,
    { col: targetCol, row: targetRow },
    INVENTORY_COLS,
  );
  if (unchanged) return { nextGearPositions, nextCurrencyPositions };

  for (const item of boardItems) {
    const next = positions.get(boardItemKey(item));
    if (next) {
      if (item.kind === "gear") {
        nextGearPositions[item.id] = next;
      } else {
        nextCurrencyPositions[item.id as CraftingCurrencyId] = next;
      }
    }
  }
  return { nextGearPositions, nextCurrencyPositions };
}

export function sortBoardForCharacter(
  state: BoardSourceState,
  characterId: CharacterId,
): {
  gearPositions: GearBoardPositions;
  currencyPositions: CraftingCurrencyBoardPositions;
} {
  const loadout = state.loadouts[characterId];
  const equippedInstanceIds = new Set(Object.values(loadout).filter(Boolean) as string[]);
  const availableInventory = state.inventories[characterId].filter((item) => !equippedInstanceIds.has(item.instanceId));
  const activeCurrencyIds = CRAFTING_CURRENCY_IDS.filter((id) => state.craftingCurrencies[id] > 0);

  const gridItems: Array<{ id: string; kind: "gear" | "currency"; originalId: string; w: number; h: number }> = [];

  for (const currencyId of activeCurrencyIds) {
    gridItems.push({
      id: boardItemKey({ kind: "currency", id: currencyId }),
      kind: "currency",
      originalId: currencyId,
      w: 1,
      h: 1,
    });
  }

  const sortedGear = [...availableInventory].sort((a, b) => {
    const aFootprint = footprintForInstance(a);
    const bFootprint = footprintForInstance(b);
    const aArea = aFootprint ? aFootprint.w * aFootprint.h : 0;
    const bArea = bFootprint ? bFootprint.w * bFootprint.h : 0;
    if (bArea !== aArea) return bArea - aArea;
    return getGearInstanceTitle(a).localeCompare(getGearInstanceTitle(b));
  });

  for (const item of sortedGear) {
    const footprint = footprintForInstance(item);
    if (!footprint) continue;
    gridItems.push({
      id: boardItemKey({ kind: "gear", id: item.instanceId }),
      kind: "gear",
      originalId: item.instanceId,
      w: footprint.w,
      h: footprint.h,
    });
  }

  const result = packGridItems(gridItems, INVENTORY_COLS);

  const gearPositions: GearBoardPositions = {};
  const currencyPositions: CraftingCurrencyBoardPositions = {};
  for (const packed of result.items) {
    if (packed.item.kind === "currency") {
      currencyPositions[packed.item.originalId as CraftingCurrencyId] = { col: packed.col, row: packed.row };
    } else {
      gearPositions[packed.item.originalId] = { col: packed.col, row: packed.row };
    }
  }

  return { gearPositions, currencyPositions };
}

export function moveBoardItemForState(
  state: BoardSourceState,
  characterId: CharacterId,
  item: BoardItemRef,
  col: number,
  row: number,
) {
  const { nextGearPositions, nextCurrencyPositions } = resolveMoveItemAndSwap(characterId, item, col, row, state);
  const nextState = {
    boardPositionsByCharacter: {
      ...state.boardPositionsByCharacter,
      [characterId]: nextGearPositions,
    },
    currencyBoardPositionsByCharacter: {
      ...state.currencyBoardPositionsByCharacter,
      [characterId]: nextCurrencyPositions,
    },
  };
  return {
    ...nextState,
    ...syncBoardPositionsForState({
      ...state,
      ...nextState,
    }),
  };
}

function syncBoardPositionsForState(state: BoardSourceState): {
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
    const cleanGearPositions = { ...gearPositions };
    let modified = false;
    for (const instanceId of Object.keys(gearPositions)) {
      if (equippedIds.has(instanceId)) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- imperative object-based registry
        delete cleanGearPositions[instanceId];
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
