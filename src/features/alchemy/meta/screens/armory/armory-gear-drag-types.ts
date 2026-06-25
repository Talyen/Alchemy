import type { GearInstance, GearSlot } from "@/lib/gear";
import type { DragDestination, DragRect } from "./drag-types";

export type GearDragOrigin =
  | { kind: "inventory"; placement: { col: number; row: number } }
  | { kind: "equipment"; slot: GearSlot };

export type GearPointerStart = (
  instance: GearInstance,
  origin: GearDragOrigin,
  rect: DOMRect,
  pointer: { x: number; y: number },
  pointerId: number,
) => void;

export type GearPointerMove = (pointer: { x: number; y: number }, pointerId: number) => void;
export type GearPointerEnd = (pointer: { x: number; y: number }, pointerId: number, cancelled?: boolean) => void;

export interface GearDragVisual {
  instance: GearInstance | null;
  source: DragRect;
  rect: DragRect;
  origin: GearDragOrigin;
  destination: DragDestination | null;
  settling?: boolean | undefined;
  flyover?: boolean | undefined;
  releasing?: boolean | undefined;
  releaseRect?: DragRect | undefined;
}
