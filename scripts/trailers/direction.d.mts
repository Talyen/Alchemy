import type { Page } from "@playwright/test";
import type { Clip } from "./model.mjs";
interface Point {
  x: number;
  y: number;
}
export function pointerPath(from: Point, to: Point, corridorY: number | null): Point[];
export function samplePointer(path: Point[], progress: number): Point;

export interface PreparedAction {
  kind: string;
  point: Point;
  label?: string | null;
  bounds?: { x: number; y: number; width: number; height: number };
  inspectedCardKey?: string;
  cardKey?: string;
}
export function prepareAction(page: Page, action: Clip["actions"][number]): Promise<PreparedAction>;
export function pointerCorridor(page: Page): Promise<number | null>;
export function performAction(page: Page, action: PreparedAction): Promise<void>;
