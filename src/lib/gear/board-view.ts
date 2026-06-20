import { CRAFTING_CURRENCY_IDS, type CraftingCurrencyBoardPositions, type CraftingCurrencyId } from "./crafting";
import { INVENTORY_COLS } from "./constants";
import { GEAR_FOOTPRINT, type GearFootprint } from "./footprints";
import { packGridItems } from "./grid-packing";
import type { PackedInventory, PackedInventoryItem } from "./inventory-placement";
import { gearDefinitions } from "./definitions";
import type { GearBoardPositions, GearInstance, GearLoadout } from "./types";

export type PackedCurrencyItem = {
  currencyId: CraftingCurrencyId;
  col: number;
  row: number;
  w: 1;
  h: 1;
};

export type ArmoryBoardView = {
  activeCurrencyIds: CraftingCurrencyId[];
  availableInventory: GearInstance[];
  packedInventory: PackedInventory;
  packedCurrencies: PackedCurrencyItem[];
  boardObstacles: PackedInventoryItem<{ instanceId: string }>[];
  occupiedRows: number;
};

export function packInventory<T>(
  items: T[],
  cols: number,
  getFootprint: (item: T) => GearFootprint,
): PackedInventory<T> {
  const result = packGridItems(
    items.map((item, idx) => {
      const footprint = getFootprint(item);
      return { id: String(idx), w: footprint.w, h: footprint.h, originalItem: item };
    }),
    cols,
  );

  return {
    items: result.items.map((packed) => ({
      item: packed.item.originalItem,
      col: packed.col,
      row: packed.row,
      w: packed.w,
      h: packed.h,
    })),
    occupiedRows: result.occupiedRows,
  };
}

export function packInventoryWithPositions<T extends { definitionId: string; instanceId: string }>(
  items: T[],
  cols: number,
  savedPositions: Record<string, { col: number; row: number }>,
  reservedItems: readonly T[] = [],
  blockedCells: readonly { col: number; row: number; w: number; h: number }[] = [],
): PackedInventory<T> {
  const mapToGridItem = (item: T) => {
    const definition = gearDefinitions[item.definitionId];
    const footprint = definition ? GEAR_FOOTPRINT[definition.compatibleSlots[0]!] : { w: 1, h: 1 };
    return {
      id: item.instanceId,
      w: footprint.w,
      h: footprint.h,
      saved: savedPositions[item.instanceId],
      originalItem: item,
    };
  };

  const gridItems = items.map(mapToGridItem);
  const gridReserved = reservedItems.map(mapToGridItem);

  const result = packGridItems(gridItems, cols, {
    reservedItems: gridReserved,
    blockedCells,
  });

  return {
    items: result.items.map((packed) => ({
      item: packed.item.originalItem,
      col: packed.col,
      row: packed.row,
      w: packed.w,
      h: packed.h,
    })),
    occupiedRows: result.occupiedRows,
  };
}

export function packCurrencyWithPositions(
  currencyIds: CraftingCurrencyId[],
  cols: number,
  savedPositions: CraftingCurrencyBoardPositions,
  gearObstacles: PackedInventoryItem[],
): PackedCurrencyItem[] {
  const gridItems = currencyIds.map((id) => ({
    id,
    w: 1,
    h: 1,
    saved: savedPositions[id],
  }));

  const blockedCells = gearObstacles.map((obs) => ({
    col: obs.col,
    row: obs.row,
    w: obs.w,
    h: obs.h,
  }));

  const result = packGridItems(gridItems, cols, { blockedCells });

  return result.items.map((packed) => ({
    currencyId: packed.item.id,
    col: packed.col,
    row: packed.row,
    w: 1,
    h: 1,
  }));
}

function currencyObstaclesForBoard(
  packedCurrencies: PackedCurrencyItem[],
): PackedInventoryItem<{ instanceId: string }>[] {
  return packedCurrencies.map(({ currencyId, col, row, w, h }) => ({
    item: { instanceId: currencyId },
    col,
    row,
    w,
    h,
  }));
}

export function buildArmoryBoardView({
  inventory,
  loadout,
  gearPositions,
  equippedReturnPositions = {},
  currencyPositions,
  craftingCurrencies,
  cols = INVENTORY_COLS,
}: {
  inventory: GearInstance[];
  loadout: GearLoadout;
  gearPositions: GearBoardPositions;
  equippedReturnPositions?: GearBoardPositions;
  currencyPositions: CraftingCurrencyBoardPositions;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  cols?: number;
}): ArmoryBoardView {
  const equippedInstanceIds = new Set(Object.values(loadout).filter(Boolean));
  const availableInventory = inventory.filter((item) => !equippedInstanceIds.has(item.instanceId));
  const reservedEquipped = inventory.filter((item) => equippedInstanceIds.has(item.instanceId));
  const activeCurrencyIds = CRAFTING_CURRENCY_IDS.filter((id) => craftingCurrencies[id] > 0);
  const currencyBlockers = activeCurrencyIds.flatMap((id) => {
    const position = currencyPositions[id];
    if (!position) return [];
    return [{ col: position.col, row: position.row, w: 1, h: 1 }];
  });

  const packedInventory = packInventoryWithPositions(
    availableInventory,
    cols,
    { ...gearPositions, ...equippedReturnPositions },
    reservedEquipped,
    currencyBlockers,
  );
  const packedCurrencies = packCurrencyWithPositions(activeCurrencyIds, cols, currencyPositions, packedInventory.items);
  const boardObstacles = [...packedInventory.items, ...currencyObstaclesForBoard(packedCurrencies)];
  const currencyRows = packedCurrencies.reduce((max, item) => Math.max(max, item.row), 0);

  return {
    activeCurrencyIds,
    availableInventory,
    packedInventory,
    packedCurrencies,
    boardObstacles,
    occupiedRows: Math.max(packedInventory.occupiedRows, currencyRows),
  };
}
