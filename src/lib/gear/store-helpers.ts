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
import { packMixedBoard } from "./grid-packing";
import {
  type CraftingCurrencyId,
  type CraftingCurrencyBoardPositions,
  type CraftingCurrencyBoardPositionsByCharacter,
  CRAFTING_CURRENCY_IDS,
} from "./crafting";
import { INVENTORY_COLS } from "./constants";

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
    const gearPositions = { ...nextBoardPositionsByCharacter[characterId] };
    const currencyPositions = { ...nextCurrencyPositionsByCharacter[characterId] };
    const mixed = buildBoardEntriesForCharacter(
      {
        ...state,
        boardPositionsByCharacter: nextBoardPositionsByCharacter,
        currencyBoardPositionsByCharacter: nextCurrencyPositionsByCharacter,
      },
      characterId,
    );

    const packed = packMixedBoard<"gear" | "currency", BoardEntry>(
      mixed,
      INVENTORY_COLS,
      (entry) => entry.footprint,
      (entry) => entry.saved,
    );

    const nextGearForChar: GearBoardPositions = {};
    const nextCurrencyForChar: CraftingCurrencyBoardPositions = {};
    const prevGearKeys = Object.keys(gearPositions).sort();
    const nextGearKeys: string[] = [];
    for (const { item, col, row } of packed) {
      if (item.kind === "gear") {
        nextGearForChar[item.item.instanceId] = { col, row };
        nextGearKeys.push(item.item.instanceId);
      } else {
        nextCurrencyForChar[item.item] = { col, row };
      }
    }
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

export function updateGearStateAndSync<T extends BoardSourceState & { equippedReturnPositions: GearBoardPositions }>(
  state: T,
  updates: Partial<T>,
): T {
  const merged = { ...state, ...updates };

  const nextReturn: GearBoardPositions = { ...merged.equippedReturnPositions };
  const nextBoardPositionsByCharacter = { ...merged.boardPositionsByCharacter };

  for (const characterId of GEAR_CHARACTER_IDS) {
    const loadout = merged.loadouts[characterId];
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

  const sanitizedGear = sanitizeGearBoardPositionsByCharacter(
    nextBoardPositionsByCharacter,
    merged.inventories,
    merged.loadouts,
  );
  const sanitizedCurrency = sanitizeCurrencyBoardPositionsByCharacter(
    merged.currencyBoardPositionsByCharacter,
    merged.craftingCurrencies,
  );
  const sanitizedReturn = sanitizeEquippedReturnPositions(nextReturn, merged.inventories, merged.loadouts);

  const finalGear = positionsByCharacterEqual(state.boardPositionsByCharacter, sanitizedGear)
    ? state.boardPositionsByCharacter
    : sanitizedGear;
  const finalCurrency = positionsByCharacterEqual(state.currencyBoardPositionsByCharacter, sanitizedCurrency)
    ? state.currencyBoardPositionsByCharacter
    : sanitizedCurrency;
  const finalReturn = positionsEqual(state.equippedReturnPositions, sanitizedReturn)
    ? state.equippedReturnPositions
    : sanitizedReturn;

  const mergedSanitized = {
    ...merged,
    boardPositionsByCharacter: finalGear,
    currencyBoardPositionsByCharacter: finalCurrency,
    equippedReturnPositions: finalReturn,
  };

  const synced = syncBoardPositionsForState(mergedSanitized);

  const finalSyncedGear = positionsByCharacterEqual(
    mergedSanitized.boardPositionsByCharacter,
    synced.boardPositionsByCharacter,
  )
    ? mergedSanitized.boardPositionsByCharacter
    : synced.boardPositionsByCharacter;
  const finalSyncedCurrency = positionsByCharacterEqual(
    mergedSanitized.currencyBoardPositionsByCharacter,
    synced.currencyBoardPositionsByCharacter,
  )
    ? mergedSanitized.currencyBoardPositionsByCharacter
    : synced.currencyBoardPositionsByCharacter;

  return {
    ...mergedSanitized,
    boardPositionsByCharacter: finalSyncedGear,
    currencyBoardPositionsByCharacter: finalSyncedCurrency,
  };
}
