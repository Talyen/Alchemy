import type { RefObject } from "react";
import type { InventoryPlacement, PackedInventoryItem } from "@/lib/gear";
import type { DragDestination, DragPoint, DragRect } from "./drag-types";

export type DragOrigin =
  | { kind: "inventory"; placement: InventoryPlacement }
  | { kind: "equipment"; slot: string }
  | { kind: "external" };

export interface BoardDragVisual<TId extends string, TOrigin extends DragOrigin> {
  id: TId;
  source: DragRect;
  rect: DragRect;
  origin: TOrigin;
  destination: DragDestination | null;
  settling?: boolean;
  releasing?: boolean;
  flyover?: boolean;
  releaseRect?: DragRect | undefined;
}

export interface PendingBoardDrag<TId extends string, TOrigin extends DragOrigin> {
  id: TId;
  origin: TOrigin;
  source: DragRect;
  pointerId: number;
  pointerStart: DragPoint;
  offset: DragPoint;
}

type FootprintFn<TId extends string, TItem> = (id: TId, lookup: TItem | undefined) => { w: number; h: number } | null;

export type BoardDragCommitResult<TItem> = { heldItem?: { item: TItem; source: DragRect } } | undefined;

export interface UseBoardDragOptions<TId extends string, TItem, TOrigin extends DragOrigin> {
  itemLookup: TItem | undefined;
  getItemId: (item: TItem) => TId;
  getOrigin: (item: TItem) => TOrigin;
  getFootprint: FootprintFn<TId, TItem>;
  inventoryBoardRef: RefObject<HTMLDivElement | null>;
  occupiedRows: number;
  externalDestinations?: readonly DragDestination[];
  resolveExternalDestination?: (pointer: DragPoint) => DragDestination | null;
  onCommit: (input: { id: TId; origin: TOrigin; destination: DragDestination }) => BoardDragCommitResult<TItem>;
  onCancel?: (id: TId) => void;
  onClear?: () => void;
  boardObstacles?: Array<PackedInventoryItem<{ instanceId: string }>>;
}
