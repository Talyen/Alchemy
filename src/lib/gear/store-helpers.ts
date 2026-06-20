import type { CharacterId } from "@/lib/game-data";
import {
  type GearBoardPositions,
  type GearBoardPositionsByCharacter,
  type GearInstance,
  type GearInventories,
  type GearLoadouts,
  GEAR_CHARACTER_IDS,
} from "./types";
import { footprintForInstance } from "./footprints";
import { resolveMoveWithSwap } from "./board-moves";
import {
  sanitizeGearBoardPositionsByCharacter,
  sanitizeCurrencyBoardPositionsByCharacter,
  sanitizeEquippedReturnPositions,
} from "./board-position-sanitizers";

import {
  type CraftingCurrencyId,
  type CraftingCurrencyBoardPositions,
  type CraftingCurrencyBoardPositionsByCharacter,
  CRAFTING_CURRENCY_IDS,
} from "./crafting";
import { INVENTORY_COLS } from "./constants";
import { packInventoryWithPositions, packCurrencyWithPositions } from "./board-view";

type BoardEntry =
  | {
      id: string;
      kind: "gear";
      item: GearInstance;
      footprint: { w: number; h: number };
      saved?: { col: number; row: number };
    }
  | {
      id: CraftingCurrencyId;
      kind: "currency";
      item: CraftingCurrencyId;
      footprint: { w: 1; h: 1 };
      saved?: { col: number; row: number };
    };

export type BoardItemRef = { kind: "gear"; id: string } | { kind: "currency"; id: CraftingCurrencyId };

export type BoardSourceState = {
  inventories: GearInventories;
  loadouts: GearLoadouts;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  boardPositionsByCharacter: GearBoardPositionsByCharacter;
  currencyBoardPositionsByCharacter: CraftingCurrencyBoardPositionsByCharacter;
};

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

function buildBoardEntriesForCharacter(state: BoardSourceState, characterId: CharacterId): BoardEntry[] {
  const equippedInstanceIds = new Set(Object.values(state.loadouts[characterId]).filter(Boolean) as string[]);
  const availableInventory = state.inventories[characterId].filter((item) => !equippedInstanceIds.has(item.instanceId));
  const activeCurrencies = CRAFTING_CURRENCY_IDS.filter((id) => state.craftingCurrencies[id] > 0);
  const gearPositions = state.boardPositionsByCharacter[characterId];
  const currencyPositions = state.currencyBoardPositionsByCharacter[characterId];

  const entries: BoardEntry[] = [];

  for (const item of availableInventory) {
    const footprint = footprintForInstance(item);
    if (!footprint) continue;
    const saved = gearPositions[item.instanceId];
    entries.push({ id: item.instanceId, kind: "gear", item, footprint, ...(saved ? { saved } : {}) });
  }

  for (const currencyId of activeCurrencies) {
    const saved = currencyPositions[currencyId];
    entries.push({
      id: currencyId,
      kind: "currency",
      item: currencyId,
      footprint: { w: 1, h: 1 },
      ...(saved ? { saved } : {}),
    });
  }

  return entries;
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

  const boardItems = buildBoardEntriesForCharacter(state, characterId).map((entry) => ({
    id: entry.id,
    kind: entry.kind,
    footprint: entry.footprint,
    position: entry.saved ?? { col: 1, row: 1 },
  }));

  if (!boardItems.some((item) => item.id === movingItem.id && item.kind === movingItem.kind)) {
    return { nextGearPositions, nextCurrencyPositions };
  }

  const { positions, unchanged } = resolveMoveWithSwap(
    boardItems,
    movingItem.id,
    { col: targetCol, row: targetRow },
    INVENTORY_COLS,
  );
  if (unchanged) return { nextGearPositions, nextCurrencyPositions };

  for (const item of boardItems) {
    const next = positions.get(item.id);
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
    const loadout = state.loadouts[characterId];
    const inventory = state.inventories[characterId];
    const equippedInstanceIds = new Set(Object.values(loadout).filter(Boolean));
    const availableInventory = inventory.filter((item) => !equippedInstanceIds.has(item.instanceId));
    const reservedEquipped = inventory.filter((item) => equippedInstanceIds.has(item.instanceId));
    const gearPositions = state.boardPositionsByCharacter[characterId];
    const currencyPositions = state.currencyBoardPositionsByCharacter[characterId];
    const activeCurrencyIds = CRAFTING_CURRENCY_IDS.filter((id) => state.craftingCurrencies[id] > 0);

    const currencyBlockers = activeCurrencyIds.flatMap((id) => {
      const position = currencyPositions[id];
      if (!position) return [];
      return [{ col: position.col, row: position.row, w: 1, h: 1 }];
    });

    const packedGear = packInventoryWithPositions(
      availableInventory,
      INVENTORY_COLS,
      gearPositions,
      reservedEquipped,
      currencyBlockers,
    );

    const packedCurrencies = packCurrencyWithPositions(
      activeCurrencyIds,
      INVENTORY_COLS,
      currencyPositions,
      packedGear.items,
    );

    const prevGearKeys = Object.keys(gearPositions).sort();
    const nextGearForChar: GearBoardPositions = {};
    for (const packed of packedGear.items) {
      nextGearForChar[packed.item.instanceId] = { col: packed.col, row: packed.row };
    }
    const nextGearKeys = Object.keys(nextGearForChar).sort();
    if (nextGearKeys.join("|") !== prevGearKeys.join("|")) changed = true;

    const prevCurrencyKeys = Object.keys(currencyPositions).sort();
    const nextCurrencyForChar: CraftingCurrencyBoardPositions = {};
    for (const packed of packedCurrencies) {
      nextCurrencyForChar[packed.currencyId] = { col: packed.col, row: packed.row };
    }
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
  equippedReturnPositions: GearBoardPositions,
): {
  boardPositionsByCharacter: GearBoardPositionsByCharacter;
  equippedReturnPositions: GearBoardPositions;
} {
  const nextReturn: GearBoardPositions = { ...equippedReturnPositions };
  const nextBoardPositionsByCharacter = { ...boardPositionsByCharacter };

  for (const characterId of GEAR_CHARACTER_IDS) {
    const loadout = loadouts[characterId];
    const equippedIds = new Set(Object.values(loadout).filter(Boolean) as string[]);
    const gearPositions = nextBoardPositionsByCharacter[characterId];
    const cleanGearPositions = { ...gearPositions };
    let modified = false;
    for (const [instanceId, position] of Object.entries(gearPositions)) {
      if (equippedIds.has(instanceId)) {
        if (!nextReturn[instanceId]) {
          nextReturn[instanceId] = position;
        }
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- imperative object-based registry
        delete cleanGearPositions[instanceId];
        modified = true;
      }
    }
    if (modified) {
      nextBoardPositionsByCharacter[characterId] = cleanGearPositions;
    }
  }

  return { boardPositionsByCharacter: nextBoardPositionsByCharacter, equippedReturnPositions: nextReturn };
}

function keepUnchangedIfEqual<T>(current: T, next: T, equal: (a: T, b: T) => boolean): T {
  return equal(current, next) ? current : next;
}

export function updateGearStateAndSync<T extends BoardSourceState & { equippedReturnPositions: GearBoardPositions }>(
  state: T,
  updates: Partial<T>,
): T {
  const merged = { ...state, ...updates };

  const afterEquipMove = moveEquippedOffBoard(
    merged.loadouts,
    merged.boardPositionsByCharacter,
    merged.equippedReturnPositions,
  );

  const sanitizedGear = sanitizeGearBoardPositionsByCharacter(
    afterEquipMove.boardPositionsByCharacter,
    merged.inventories,
    merged.loadouts,
  );
  const sanitizedCurrency = sanitizeCurrencyBoardPositionsByCharacter(
    merged.currencyBoardPositionsByCharacter,
    merged.craftingCurrencies,
  );
  const sanitizedReturn = sanitizeEquippedReturnPositions(
    afterEquipMove.equippedReturnPositions,
    merged.inventories,
    merged.loadouts,
  );

  const finalGear = keepUnchangedIfEqual(state.boardPositionsByCharacter, sanitizedGear, positionsByCharacterEqual);
  const finalCurrency = keepUnchangedIfEqual(
    state.currencyBoardPositionsByCharacter,
    sanitizedCurrency,
    positionsByCharacterEqual,
  );
  const finalReturn = keepUnchangedIfEqual(state.equippedReturnPositions, sanitizedReturn, positionsEqual);

  const mergedSanitized = {
    ...merged,
    boardPositionsByCharacter: finalGear,
    currencyBoardPositionsByCharacter: finalCurrency,
    equippedReturnPositions: finalReturn,
  };

  const synced = syncBoardPositionsForState(mergedSanitized);

  const finalSyncedGear = keepUnchangedIfEqual(
    mergedSanitized.boardPositionsByCharacter,
    synced.boardPositionsByCharacter,
    positionsByCharacterEqual,
  );
  const finalSyncedCurrency = keepUnchangedIfEqual(
    mergedSanitized.currencyBoardPositionsByCharacter,
    synced.currencyBoardPositionsByCharacter,
    positionsByCharacterEqual,
  );

  return {
    ...mergedSanitized,
    boardPositionsByCharacter: finalSyncedGear,
    currencyBoardPositionsByCharacter: finalSyncedCurrency,
  };
}
