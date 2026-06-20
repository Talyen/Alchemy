import { gearDefinitions } from "./definitions";
import {
  CRAFTING_CURRENCY_IDS,
  createEmptyCurrencyBoardPositionsByCharacter,
  type CraftingCurrencyBoardPositions,
  type CraftingCurrencyBoardPositionsByCharacter,
  type CraftingCurrencyId,
} from "./crafting";
import { GEAR_SWAP_MAX_SEARCH_ROWS, INVENTORY_COLS, INVENTORY_VISIBLE_ROWS } from "./constants";
import {
  GEAR_CHARACTER_IDS,
  createEmptyGearBoardPositionsByCharacter,
  type GearBoardPositions,
  type GearBoardPositionsByCharacter,
  type GearDefinition,
  type GearInventories,
  type GearInstance,
  type GearLoadout,
  type GearSlot,
} from "./types";

export type GearFootprint = { w: number; h: number };

export const GEAR_FOOTPRINT: Record<GearSlot, GearFootprint> = {
  helm: { w: 2, h: 2 },
  body: { w: 2, h: 3 },
  "main-hand": { w: 2, h: 3 },
  "off-hand": { w: 2, h: 3 },
  gloves: { w: 2, h: 2 },
  boots: { w: 2, h: 2 },
  belt: { w: 2, h: 1 },
  amulet: { w: 1, h: 1 },
  "left-ring": { w: 1, h: 1 },
  "right-ring": { w: 1, h: 1 },
};

export type PackedInventoryItem<T = GearInstance> = {
  item: T;
  col: number;
  row: number;
  w: number;
  h: number;
};

export type PackedInventory<T = GearInstance> = {
  items: PackedInventoryItem<T>[];
  occupiedRows: number;
};

export type InventoryPlacement = { col: number; row: number };

export type InventoryGridMetrics = {
  cellSize: number;
  gap: number;
  cols: number;
  rows: number;
};

export type BoardItem<TKind extends string = string> = {
  id: string;
  kind: TKind;
  footprint: GearFootprint;
  position: InventoryPlacement;
};

function ensureRows(occupancy: boolean[][], rows: number, cols: number): void {
  while (occupancy.length < rows) {
    occupancy.push(Array.from({ length: cols }, () => false));
  }
}

function canPlace(occupancy: boolean[][], col: number, row: number, footprint: GearFootprint, cols: number): boolean {
  if (col < 1 || row < 1 || col + footprint.w - 1 > cols) return false;
  ensureRows(occupancy, row + footprint.h - 1, cols);
  for (let y = row - 1; y < row - 1 + footprint.h; y++) {
    for (let x = col - 1; x < col - 1 + footprint.w; x++) {
      if (occupancy[y]?.[x]) return false;
    }
  }
  return true;
}

export function inventoryPlacementCollides<T extends { instanceId: string }>(
  items: PackedInventoryItem<T>[],
  draggedInstanceId: string,
  placement: InventoryPlacement,
  footprint: GearFootprint,
  cols: number,
): boolean {
  if (placement.col < 1 || placement.row < 1 || placement.col + footprint.w - 1 > cols) return true;

  return items.some((item) => {
    if (item.item.instanceId === draggedInstanceId) return false;
    return !(
      placement.col + footprint.w <= item.col ||
      item.col + item.w <= placement.col ||
      placement.row + footprint.h <= item.row ||
      item.row + item.h <= placement.row
    );
  });
}

export function inventoryPlacementRect(
  placement: InventoryPlacement,
  footprint: GearFootprint,
  metrics: Pick<InventoryGridMetrics, "cellSize" | "gap">,
): { left: number; top: number; width: number; height: number } {
  const stride = metrics.cellSize + metrics.gap;
  return {
    left: (placement.col - 1) * stride,
    top: (placement.row - 1) * stride,
    width: footprint.w * metrics.cellSize + (footprint.w - 1) * metrics.gap,
    height: footprint.h * metrics.cellSize + (footprint.h - 1) * metrics.gap,
  };
}

export function findNearestInventoryPlacement<T extends { instanceId: string }>(
  items: PackedInventoryItem<T>[],
  draggedInstanceId: string,
  footprint: GearFootprint,
  metrics: InventoryGridMetrics,
  targetCenter: { x: number; y: number },
): InventoryPlacement | null {
  let nearest: InventoryPlacement | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  const lastRow = Math.max(1, metrics.rows - footprint.h + 1);

  for (let row = 1; row <= lastRow; row++) {
    for (let col = 1; col <= metrics.cols - footprint.w + 1; col++) {
      const placement = { col, row };
      if (inventoryPlacementCollides(items, draggedInstanceId, placement, footprint, metrics.cols)) continue;
      const rect = inventoryPlacementRect(placement, footprint, metrics);
      const dx = rect.left + rect.width / 2 - targetCenter.x;
      const dy = rect.top + rect.height / 2 - targetCenter.y;
      const distance = dx * dx + dy * dy;
      if (distance < nearestDistance) {
        nearest = placement;
        nearestDistance = distance;
      }
    }
  }

  return nearest;
}

export function findFirstInventoryPlacement<T extends { instanceId: string }>(
  items: PackedInventoryItem<T>[],
  draggedInstanceId: string,
  footprint: GearFootprint,
  cols: number,
): InventoryPlacement {
  for (let row = 1; ; row++) {
    for (let col = 1; col <= cols - footprint.w + 1; col++) {
      const placement = { col, row };
      if (!inventoryPlacementCollides(items, draggedInstanceId, placement, footprint, cols)) return placement;
    }
  }
}

function markPlaced(occupancy: boolean[][], col: number, row: number, footprint: GearFootprint, cols: number): void {
  ensureRows(occupancy, row + footprint.h - 1, cols);
  for (let y = row - 1; y < row - 1 + footprint.h; y++) {
    for (let x = col - 1; x < col - 1 + footprint.w; x++) {
      if (occupancy[y]) occupancy[y]![x] = true;
    }
  }
}

function findPlacement(occupancy: boolean[][], footprint: GearFootprint, cols: number): { col: number; row: number } {
  for (let row = 1; ; row++) {
    for (let col = 1; col <= cols - footprint.w + 1; col++) {
      if (canPlace(occupancy, col, row, footprint, cols)) return { col, row };
    }
  }
}

function overlaps(
  a: { col: number; row: number; w: number; h: number },
  b: { col: number; row: number; w: number; h: number },
): boolean {
  return !(a.col + a.w <= b.col || b.col + b.w <= a.col || a.row + a.h <= b.row || b.row + b.h <= a.row);
}

type GridItemInput = {
  id: string;
  w: number;
  h: number;
  saved?: { col: number; row: number } | undefined;
};

function packGridItemsGeneric<TInput extends GridItemInput>(
  items: TInput[],
  cols: number,
  options: {
    reservedItems?: readonly TInput[];
    blockedCells?: readonly { col: number; row: number; w: number; h: number }[];
  } = {},
): { items: { item: TInput; col: number; row: number; w: number; h: number }[]; occupiedRows: number } {
  const { reservedItems = [], blockedCells = [] } = options;
  const packedItems: { item: TInput; col: number; row: number; w: number; h: number }[] = [];
  const occupancy: boolean[][] = [];
  let occupiedRows = 0;
  const visibleIds = new Set(items.map((item) => item.id));

  for (const cell of blockedCells) {
    if (cell.col < 1 || cell.row < 1 || cell.col + cell.w - 1 > cols) continue;
    markPlaced(occupancy, cell.col, cell.row, { w: cell.w, h: cell.h }, cols);
    occupiedRows = Math.max(occupiedRows, cell.row - 1 + cell.h);
  }

  for (const item of reservedItems) {
    if (visibleIds.has(item.id)) continue;
    const saved = item.saved;
    if (!saved || saved.col < 1 || saved.row < 1 || saved.col + item.w - 1 > cols) continue;
    if (!canPlace(occupancy, saved.col, saved.row, { w: item.w, h: item.h }, cols)) continue;
    markPlaced(occupancy, saved.col, saved.row, { w: item.w, h: item.h }, cols);
    occupiedRows = Math.max(occupiedRows, saved.row - 1 + item.h);
  }

  const remainingItems: TInput[] = [];

  for (const item of items) {
    const saved = item.saved;
    if (saved && saved.col >= 1 && saved.row >= 1 && saved.col + item.w - 1 <= cols) {
      if (canPlace(occupancy, saved.col, saved.row, { w: item.w, h: item.h }, cols)) {
        markPlaced(occupancy, saved.col, saved.row, { w: item.w, h: item.h }, cols);
        packedItems.push({
          item,
          col: saved.col,
          row: saved.row,
          w: item.w,
          h: item.h,
        });
        occupiedRows = Math.max(occupiedRows, saved.row - 1 + item.h);
        continue;
      }
    }
    remainingItems.push(item);
  }

  for (const item of remainingItems) {
    if (item.w < 1 || item.h < 1 || item.w > cols) {
      throw new RangeError(`Inventory footprint ${item.w}x${item.h} does not fit ${cols}-column board`);
    }
    const position = findPlacement(occupancy, { w: item.w, h: item.h }, cols);
    packedItems.push({ item, col: position.col, row: position.row, w: item.w, h: item.h });
    markPlaced(occupancy, position.col, position.row, { w: item.w, h: item.h }, cols);
    occupiedRows = Math.max(occupiedRows, position.row - 1 + item.h);
  }

  return { items: packedItems, occupiedRows };
}

export function packInventory<T>(
  items: T[],
  cols: number,
  getFootprint: (item: T) => GearFootprint,
): PackedInventory<T> {
  const gridItems = items.map((item, idx) => {
    const footprint = getFootprint(item);
    return {
      id: String(idx),
      w: footprint.w,
      h: footprint.h,
      originalItem: item,
    };
  });

  const result = packGridItemsGeneric(gridItems, cols);

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

export function getInventoryFootprint(definition: GearDefinition, selectedSlot: GearSlot | null): GearFootprint {
  if (selectedSlot) return GEAR_FOOTPRINT[selectedSlot];
  return GEAR_FOOTPRINT[definition.compatibleSlots[0]!];
}

export function footprintForInstance(instance: { definitionId: string }): GearFootprint | null {
  const definition = gearDefinitions[instance.definitionId];
  if (!definition) return null;
  return GEAR_FOOTPRINT[definition.compatibleSlots[0]!];
}

export function canOccupyVacatedInventoryPlacement(
  items: PackedInventoryItem[],
  incomingInstanceId: string,
  incomingFootprint: GearFootprint,
  displacedFootprint: GearFootprint,
  placement: InventoryPlacement,
  cols: number,
): boolean {
  if (placement.col < 1 || placement.row < 1 || placement.col + displacedFootprint.w - 1 > cols) {
    return false;
  }
  if (incomingFootprint.w === displacedFootprint.w && incomingFootprint.h === displacedFootprint.h) {
    return true;
  }
  return !inventoryPlacementCollides(
    items.filter((item) => item.item.instanceId !== incomingInstanceId),
    "__vacated__",
    placement,
    displacedFootprint,
    cols,
  );
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

  const result = packGridItemsGeneric(gridItems, cols, {
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

export function resolveInventoryReturnPlacement<T extends { instanceId: string }>(
  items: PackedInventoryItem<T>[],
  instanceId: string,
  footprint: GearFootprint,
  preferred: InventoryPlacement | undefined,
  cols: number,
): InventoryPlacement {
  if (preferred && !inventoryPlacementCollides(items, instanceId, preferred, footprint, cols)) {
    return preferred;
  }
  return findFirstInventoryPlacement(items, instanceId, footprint, cols);
}

export type PackedCurrencyItem = {
  currencyId: CraftingCurrencyId;
  col: number;
  row: number;
  w: 1;
  h: 1;
};

function sanitizeCurrencyBoardPositions(
  boardPositions: CraftingCurrencyBoardPositions,
  currencies: Record<CraftingCurrencyId, number>,
): CraftingCurrencyBoardPositions {
  const next: CraftingCurrencyBoardPositions = {};
  for (const id of CRAFTING_CURRENCY_IDS) {
    if (currencies[id] <= 0) continue;
    const position = boardPositions[id];
    if (!position) continue;
    if (position.col < 1 || position.row < 1 || position.col > INVENTORY_COLS) continue;
    next[id] = position;
  }
  return next;
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

  const result = packGridItemsGeneric(gridItems, cols, { blockedCells });

  return result.items.map((packed) => ({
    currencyId: packed.item.id as CraftingCurrencyId,
    col: packed.col,
    row: packed.row,
    w: 1 as const,
    h: 1 as const,
  }));
}

export function currencyObstaclesForBoard(
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

export type ArmoryBoardView = {
  activeCurrencyIds: CraftingCurrencyId[];
  availableInventory: GearInstance[];
  packedInventory: PackedInventory;
  packedCurrencies: PackedCurrencyItem[];
  boardObstacles: PackedInventoryItem<{ instanceId: string }>[];
  occupiedRows: number;
};

export function buildArmoryBoardView({
  inventory,
  loadout,
  gearPositions,
  currencyPositions,
  craftingCurrencies,
  cols = INVENTORY_COLS,
}: {
  inventory: GearInstance[];
  loadout: GearLoadout;
  gearPositions: GearBoardPositions;
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
    gearPositions,
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

export {
  GEAR_SWAP_MAX_SEARCH_ROWS,
  INVENTORY_COLS,
  INVENTORY_VISIBLE_ROWS,
  canPlace,
  markPlaced,
  findPlacement,
  overlaps,
};

export function sanitizeGearBoardPositions(
  boardPositions: GearBoardPositions,
  inventory: GearInstance[],
): GearBoardPositions {
  const inventoryIds = new Set(inventory.map((item) => item.instanceId));
  const next: GearBoardPositions = {};
  for (const [instanceId, position] of Object.entries(boardPositions)) {
    if (!inventoryIds.has(instanceId)) continue;
    const item = inventory.find((entry) => entry.instanceId === instanceId);
    if (!item) continue;
    const footprint = footprintForInstance(item);
    if (!footprint) continue;
    if (position.col < 1 || position.row < 1 || position.col + footprint.w - 1 > INVENTORY_COLS) continue;
    next[instanceId] = position;
  }
  return next;
}

export function sanitizeGearBoardPositionsByCharacter(
  boardPositionsByCharacter: GearBoardPositionsByCharacter,
  inventories: GearInventories,
): GearBoardPositionsByCharacter {
  const next = createEmptyGearBoardPositionsByCharacter();
  for (const characterId of GEAR_CHARACTER_IDS) {
    next[characterId] = sanitizeGearBoardPositions(boardPositionsByCharacter[characterId], inventories[characterId]);
  }
  return next;
}

export function sanitizeCurrencyBoardPositionsByCharacter(
  boardPositionsByCharacter: CraftingCurrencyBoardPositionsByCharacter,
  currencies: Record<CraftingCurrencyId, number>,
): CraftingCurrencyBoardPositionsByCharacter {
  const next = createEmptyCurrencyBoardPositionsByCharacter();
  for (const characterId of GEAR_CHARACTER_IDS) {
    next[characterId] = sanitizeCurrencyBoardPositions(boardPositionsByCharacter[characterId], currencies);
  }
  return next;
}

export function resolveMoveWithSwap<TKind extends string>(
  items: BoardItem<TKind>[],
  movingId: string,
  target: InventoryPlacement,
  cols: number,
  options: { maxSearchRows?: number } = {},
): { positions: Map<string, InventoryPlacement>; unchanged: boolean } {
  const { maxSearchRows = GEAR_SWAP_MAX_SEARCH_ROWS } = options;
  const positions = new Map<string, InventoryPlacement>();
  for (const item of items) positions.set(item.id, item.position);

  const moving = items.find((item) => item.id === movingId);
  if (!moving) return { positions, unchanged: true };
  if (moving.position.col === target.col && moving.position.row === target.row) {
    return { positions, unchanged: true };
  }

  const targetRect = { col: target.col, row: target.row, w: moving.footprint.w, h: moving.footprint.h };
  const others = items.filter((item) => item.id !== movingId);
  const displaced: BoardItem<TKind>[] = [];
  const fixed: BoardItem<TKind>[] = [];
  for (const item of others) {
    const itemRect = { col: item.position.col, row: item.position.row, w: item.footprint.w, h: item.footprint.h };
    if (overlaps(targetRect, itemRect)) displaced.push(item);
    else fixed.push(item);
  }
  displaced.sort((a, b) => b.footprint.w * b.footprint.h - a.footprint.w * a.footprint.h);

  const placed: BoardItem<TKind>[] = [{ ...moving, position: target }, ...fixed];

  const isOccupied = (col: number, row: number, w: number, h: number): boolean => {
    if (col < 1 || col + w - 1 > cols || row < 1) return true;
    return placed.some((p) =>
      overlaps({ col: p.position.col, row: p.position.row, w: p.footprint.w, h: p.footprint.h }, { col, row, w, h }),
    );
  };

  for (const item of displaced) {
    let bestCol = 1;
    let bestRow = 1;
    let bestDistanceSq = Number.POSITIVE_INFINITY;
    const origCenterX = item.position.col + (item.footprint.w - 1) / 2;
    const origCenterY = item.position.row + (item.footprint.h - 1) / 2;

    for (let r = 1; r <= maxSearchRows; r++) {
      for (let c = 1; c <= cols - item.footprint.w + 1; c++) {
        if (isOccupied(c, r, item.footprint.w, item.footprint.h)) continue;
        const candCenterX = c + (item.footprint.w - 1) / 2;
        const candCenterY = r + (item.footprint.h - 1) / 2;
        const dx = origCenterX - candCenterX;
        const dy = origCenterY - candCenterY;
        const distSq = dx * dx + dy * dy;
        if (distSq < bestDistanceSq) {
          bestDistanceSq = distSq;
          bestCol = c;
          bestRow = r;
        }
      }
    }

    const next: BoardItem<TKind> = { ...item, position: { col: bestCol, row: bestRow } };
    placed.push(next);
  }

  for (const item of placed) positions.set(item.id, item.position);
  return { positions, unchanged: false };
}
