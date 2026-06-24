// Leaf module for armory drag types — no imports from siblings.
// Kept separate so use-board-drag.ts, board-drag-math.ts, and consumers can
// reference the same types without a circular dependency.

import type { InventoryPlacement } from "@/lib/gear";

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
export type DragDestination =
  | { kind: "inventory"; placement: InventoryPlacement; rect: DragRect }
  | { kind: "equipment"; slot: string; rect: DragRect }
  | { kind: "external"; rect: DragRect };
