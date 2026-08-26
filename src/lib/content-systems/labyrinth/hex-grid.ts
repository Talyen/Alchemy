/**
 * Pointy-top hex adjacency and projection. Single source of truth for generation,
 * reachability, and map layout.
 */
import type { LabyrinthGridPosition } from "../types";

export const LABYRINTH_HEX = {
  fullColumnsAcross: 4,
  minNodesPerFloor: 9,
  maxNodesPerFloor: 12,
  /** Inclusive max row index (rows 0–5). */
  maxFloorRows: 5,
  loopChance: 0.2,
  maxNodeDegree: 3,
  layoutAttempts: 80,
} as const;

export function hexKey(position: LabyrinthGridPosition): string {
  return `${position.row},${position.col}`;
}

export function projectedHalfColumn(position: LabyrinthGridPosition): number {
  return 2 * position.col + position.row;
}

/** Offset-column index for a 4-wide pointy-top floor that starts at (0, 0). */
export function hexVisualColumn(position: LabyrinthGridPosition): number {
  return position.col + Math.floor(position.row / 2);
}

export function isHexInBounds(position: LabyrinthGridPosition): boolean {
  if (position.row < 0 || position.row > LABYRINTH_HEX.maxFloorRows) return false;
  const column = hexVisualColumn(position);
  return column >= 0 && column < LABYRINTH_HEX.fullColumnsAcross;
}

export function areHexesAdjacent(a: LabyrinthGridPosition, b: LabyrinthGridPosition): boolean {
  const rowDelta = b.row - a.row;
  const columnDelta = b.col - a.col;
  return (
    (rowDelta === 0 && Math.abs(columnDelta) === 1) ||
    (rowDelta === 1 && (columnDelta === 0 || columnDelta === -1)) ||
    (rowDelta === -1 && (columnDelta === 0 || columnDelta === 1))
  );
}

export function hexNeighbors(position: LabyrinthGridPosition): LabyrinthGridPosition[] {
  return [
    { row: position.row, col: position.col - 1 },
    { row: position.row, col: position.col + 1 },
    { row: position.row + 1, col: position.col },
    { row: position.row + 1, col: position.col - 1 },
    { row: position.row - 1, col: position.col },
    { row: position.row - 1, col: position.col + 1 },
  ];
}

export function hexRadius(availableWidth: number, edgePad = 0): number {
  const usableWidth = Math.max(1, availableWidth - edgePad * 2);
  return usableWidth / (LABYRINTH_HEX.fullColumnsAcross * Math.sqrt(3));
}

export function hexMetrics(radius: number) {
  return {
    radius,
    width: radius * Math.sqrt(3),
    height: radius * 2,
    verticalStep: radius * 1.5,
  };
}

export function projectedX(position: LabyrinthGridPosition, radius: number): number {
  return radius * Math.sqrt(3) * (position.col + position.row / 2);
}

export function compareHexPositions(a: LabyrinthGridPosition, b: LabyrinthGridPosition): number {
  return a.row === b.row ? a.col - b.col : a.row - b.row;
}
