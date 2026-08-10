// Single leaf module for armory drag-and-drop types.
// This is the only source of truth for drag shapes; the drag FSM hook, the
// resolve helpers, and the screen components all import from here.

import type { RefObject } from "react";
import type { CraftingCurrencyId, GearInstance, GearSlot, InventoryPlacement, PackedInventoryItem } from "@/lib/gear";

// ── Geometry ──

export interface DragPoint {
  x: number;
  y: number;
}

export interface DragRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// ── Destinations & origins ──

export type DragDestination =
  | { kind: "inventory"; placement: InventoryPlacement; rect: DragRect }
  | { kind: "equipment"; slot: string; rect: DragRect }
  | { kind: "external"; rect: DragRect };

export type DragOrigin =
  | { kind: "inventory"; placement: InventoryPlacement }
  | { kind: "equipment"; slot: string }
  | { kind: "external" };

export type GearDragOrigin =
  | { kind: "inventory"; placement: { col: number; row: number } }
  | { kind: "equipment"; slot: GearSlot };

export interface CurrencyDragOrigin {
  kind: "inventory";
  placement: InventoryPlacement;
}

export type ArmoryDragOrigin = GearDragOrigin | CurrencyDragOrigin;

// ── Dragged payloads ──

export type ArmoryDragItem =
  | { kind: "gear"; instance: GearInstance; origin: GearDragOrigin }
  | { kind: "currency"; currencyId: CraftingCurrencyId; origin: CurrencyDragOrigin };

// ── Visual state (shared by the drag portal and the on-screen overlays) ──

export interface DragVisualBase {
  source: DragRect;
  rect: DragRect;
  releaseRect?: DragRect | undefined;
  settling?: boolean | undefined;
  releasing?: boolean | undefined;
  flyover?: boolean | undefined;
}

interface DragVisualFields extends DragVisualBase {
  destination: DragDestination | null;
}

export type GearDragVisual = DragVisualFields & {
  instance: GearInstance | null;
  origin: GearDragOrigin;
};

export type CurrencyDragVisual = DragVisualFields & {
  currencyId: CraftingCurrencyId;
  origin: CurrencyDragOrigin;
};

// ── Pointer wiring contract used by the panels ──

export type GearPointerStart = (
  instance: GearInstance,
  origin: GearDragOrigin,
  rect: DOMRect,
  pointer: DragPoint,
  pointerId: number,
) => void;
export type GearPointerMove = (pointer: DragPoint, pointerId: number) => void;
export type GearPointerEnd = (pointer: DragPoint, pointerId: number, cancelled?: boolean) => void;

export type CurrencyPointerStart = (
  currencyId: CraftingCurrencyId,
  origin: CurrencyDragOrigin,
  rect: DOMRect,
  pointer: DragPoint,
  pointerId: number,
) => void;
export type CurrencyPointerMove = (pointer: DragPoint, pointerId: number) => void;
export type CurrencyPointerEnd = (pointer: DragPoint, pointerId: number, cancelled?: boolean) => void;

// ── Drag FSM state machine types ──

export interface PendingBoardDrag<TOrigin extends DragOrigin> {
  id: string;
  origin: TOrigin;
  source: DragRect;
  pointerId: number;
  pointerStart: DragPoint;
  offset: DragPoint;
}

export interface BoardDragVisual<TOrigin extends DragOrigin> extends DragVisualFields {
  id: string;
  origin: TOrigin;
}

export type BoardDragCommitResult<TItem> = { heldItem?: { item: TItem; source: DragRect } } | undefined;

export interface UseBoardDragOptions<TItem, TOrigin extends DragOrigin> {
  getItemId: (item: TItem) => string;
  getOrigin: (item: TItem) => TOrigin;
  getFootprint: (id: string) => { w: number; h: number } | null;
  inventoryBoardRef: RefObject<HTMLDivElement | null>;
  occupiedRows: number;
  resolveExternalDestination?: (pointer: DragPoint) => DragDestination | null;
  onCommit: (input: { id: string; origin: TOrigin; destination: DragDestination }) => BoardDragCommitResult<TItem>;
  onCancel?: (id: string) => void;
  onClear?: () => void;
  boardObstacles?: Array<PackedInventoryItem<{ instanceId: string }>>;
}
