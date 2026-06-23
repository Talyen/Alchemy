// Grid positioning and connection geometry for the labyrinth map screen.
import type { CSSProperties } from "react";

import type { LabyrinthMap } from "@/lib/content-systems/types";
import { LABYRINTH_MAP_UI } from "@/lib/game-constants";

export function getUniqueConnections(map: LabyrinthMap) {
  const seen = new Set<string>();
  const result: Array<{ from: { row: number; col: number }; to: { row: number; col: number } }> = [];
  for (let row = 0; row < map.rows; row += 1) {
    for (let col = 0; col < map.cols; col += 1) {
      const node = map.grid[row]?.[col];
      if (!node) continue;
      for (const connection of node.connections) {
        const keyA = `${row},${col}`;
        const keyB = `${connection.row},${connection.col}`;
        const key = keyA < keyB ? `${keyA}-${keyB}` : `${keyB}-${keyA}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({ from: { row, col }, to: connection });
      }
    }
  }
  return result;
}

export function positionStyle(row: number, col: number, rows: number, cols: number): CSSProperties {
  const position = positionFor(row, col, rows, cols);
  return { left: `${position.left}%`, top: `${position.top}%` };
}

export function positionFor(row: number, col: number, rows: number, cols: number) {
  const gutter = LABYRINTH_MAP_UI.mapGutter;
  return {
    left: gutter + (col * (100 - gutter * 2)) / Math.max(1, cols - 1),
    top: gutter + (row * (100 - gutter * 2)) / Math.max(1, rows - 1),
  };
}

export function trimLine(from: { x: number; y: number }, to: { x: number; y: number }, amount: number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  return {
    from: { x: from.x + ux * amount, y: from.y + uy * amount },
    to: { x: to.x - ux * amount, y: to.y - uy * amount },
  };
}
