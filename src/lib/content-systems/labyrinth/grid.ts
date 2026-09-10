import type { LabyrinthGridPosition } from "../types";

export const LABYRINTH_GRID = {
  rows: 4,
  columns: 4,
  sideColumns: 1,
  minimumBossColumnDistance: 2,
} as const;

export function gridKey(position: LabyrinthGridPosition): string {
  return `${position.row},${position.col}`;
}

export function isInLabyrinthGrid(position: LabyrinthGridPosition): boolean {
  const inset = position.row > 0 && position.row < LABYRINTH_GRID.rows - 1 ? LABYRINTH_GRID.sideColumns : 0;
  return (
    Number.isInteger(position.row) &&
    Number.isInteger(position.col) &&
    position.row >= 0 &&
    position.row < LABYRINTH_GRID.rows &&
    position.col >= -inset &&
    position.col < LABYRINTH_GRID.columns + inset
  );
}

export function labyrinthGridPositions(): LabyrinthGridPosition[] {
  const { rows, columns, sideColumns } = LABYRINTH_GRID;
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns + 2 * sideColumns }, (_, index) => ({ row, col: index - sideColumns })),
  )
    .flat()
    .filter(isInLabyrinthGrid);
}

export function areGridNeighbors(a: LabyrinthGridPosition, b: LabyrinthGridPosition): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}
