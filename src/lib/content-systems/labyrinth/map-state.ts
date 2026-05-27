/**
 * Labyrinth map traversal state: enter checks and current/failed node updates.
 */
import type { LabyrinthMap } from "../types";
import { LABYRINTH_START_COL, LABYRINTH_START_ROW } from "./data";

export function canEnterLabyrinthNode(map: LabyrinthMap, row: number, col: number): boolean {
  const node = map.grid[row]?.[col];
  if (!node) return false;
  const current = map.grid[map.currentNode.row]?.[map.currentNode.col];
  const connectedToCurrent = Boolean(
    current?.connections.some((connection) => connection.row === row && connection.col === col),
  );
  return node.state === "visible" && connectedToCurrent;
}

export function setCurrentNode(map: LabyrinthMap, row: number, col: number): void {
  const prev = map.grid[map.currentNode.row]?.[map.currentNode.col];
  if (prev && prev.state === "current") {
    prev.state = "cleared";
  }

  const node = map.grid[row]?.[col];
  if (node) {
    node.state = "current";
    map.currentNode = { row, col };
  }
}

export function withCurrentNode(map: LabyrinthMap, row: number, col: number): LabyrinthMap {
  const grid = map.grid.map((r) => r.map((n) => (n ? { ...n } : n)));
  const next: LabyrinthMap = { ...map, grid };
  setCurrentNode(next, row, col);
  return next;
}

export function failNode(map: LabyrinthMap, row: number, col: number): void {
  for (const r of map.grid) {
    for (const node of r) {
      if (node?.state === "current") {
        node.state = "cleared";
      }
    }
  }
  const node = map.grid[row]?.[col];
  if (node) {
    node.state = "failed";
  }
  const start = map.grid[LABYRINTH_START_ROW]?.[LABYRINTH_START_COL];
  if (start && start.state !== "failed") {
    start.state = "current";
    map.currentNode = { row: LABYRINTH_START_ROW, col: LABYRINTH_START_COL };
  }
}

export function withFailedNode(map: LabyrinthMap, pending: { row: number; col: number }): LabyrinthMap {
  const grid = map.grid.map((r) => r.map((n) => (n ? { ...n, connections: [...n.connections] } : n)));
  const next: LabyrinthMap = { ...map, grid };
  failNode(next, pending.row, pending.col);
  return next;
}
