import type { GearFootprint } from "./footprints";
import type { InventoryPlacement } from "./inventory-placement";
import { overlaps } from "./grid-packing";
import { GEAR_SWAP_MAX_SEARCH_ROWS } from "./constants";

export interface BoardItem<TKind extends string = string> {
  id: string;
  kind: TKind;
  footprint: GearFootprint;
  position: InventoryPlacement;
}

export function boardItemKey(item: Pick<BoardItem, "id" | "kind">): string {
  return `${item.kind}:${item.id}`;
}

export function resolveMoveWithSwap<TKind extends string>(
  items: Array<BoardItem<TKind>>,
  movingItem: Pick<BoardItem<TKind>, "id" | "kind">,
  target: InventoryPlacement,
  cols: number,
  options: { maxSearchRows?: number } = {},
): { positions: Map<string, InventoryPlacement>; unchanged: boolean } {
  const { maxSearchRows = GEAR_SWAP_MAX_SEARCH_ROWS } = options;
  const positions = new Map<string, InventoryPlacement>();
  for (const item of items) positions.set(boardItemKey(item), item.position);

  const movingKey = boardItemKey(movingItem);
  const moving = items.find((item) => boardItemKey(item) === movingKey);
  if (!moving) return { positions, unchanged: true };
  if (moving.position.col === target.col && moving.position.row === target.row) {
    return { positions, unchanged: true };
  }

  const targetRect = { col: target.col, row: target.row, w: moving.footprint.w, h: moving.footprint.h };
  const others = items.filter((item) => boardItemKey(item) !== movingKey);
  const displaced: Array<BoardItem<TKind>> = [];
  const fixed: Array<BoardItem<TKind>> = [];
  for (const item of others) {
    const itemRect = { col: item.position.col, row: item.position.row, w: item.footprint.w, h: item.footprint.h };
    if (overlaps(targetRect, itemRect)) displaced.push(item);
    else fixed.push(item);
  }
  displaced.sort((a, b) => b.footprint.w * b.footprint.h - a.footprint.w * a.footprint.h);

  const placed: Array<BoardItem<TKind>> = [{ ...moving, position: target }, ...fixed];

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

  for (const item of placed) positions.set(boardItemKey(item), item.position);
  return { positions, unchanged: false };
}
