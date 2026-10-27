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

export function neighboringGridKeys({ row, col }: LabyrinthGridPosition): string[] {
  return [`${row + 1},${col}`, `${row - 1},${col}`, `${row},${col + 1}`, `${row},${col - 1}`];
}

export function isInLabyrinthGrid(position: LabyrinthGridPosition): boolean {
  if (!Number.isInteger(position.row) || !Number.isInteger(position.col)) return false;
  const inset = position.row > 0 && position.row < LABYRINTH_GRID.rows - 1 ? LABYRINTH_GRID.sideColumns : 0;
  return (
    position.row >= 0 &&
    position.row < LABYRINTH_GRID.rows &&
    position.col >= -inset &&
    position.col < LABYRINTH_GRID.columns + inset
  );
}

export function labyrinthGridPositions(): LabyrinthGridPosition[] {
  const { rows, columns, sideColumns } = LABYRINTH_GRID;
  const positions: LabyrinthGridPosition[] = [];
  for (let row = 0; row < rows; row += 1) {
    const inset = row > 0 && row < rows - 1 ? sideColumns : 0;
    for (let col = 0 - inset; col < columns + inset; col += 1) positions.push({ row, col });
  }
  return positions;
}

export function areGridNeighbors(a: LabyrinthGridPosition, b: LabyrinthGridPosition): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}
