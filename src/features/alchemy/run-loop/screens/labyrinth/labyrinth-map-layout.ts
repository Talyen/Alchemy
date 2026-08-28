import type { LabyrinthGridPosition, LabyrinthNode } from "@/lib/content-systems/types";
import { hexMetrics, hexRadius, projectedX } from "@/lib/content-systems/labyrinth/hex-grid";
import { LABYRINTH_MAP_UI } from "@/lib/game-constants";

export function layoutFloorNodes(nodes: LabyrinthNode[], availableWidth: number) {
  const packedWidth = hexMetrics(hexRadius(availableWidth)).width;
  const metrics = hexMetrics(hexRadius(availableWidth, packedWidth / 2));
  const projectedXs = nodes.map((node) => projectedX(node.gridPosition, metrics.radius));
  const minX = Math.min(...projectedXs, 0);
  const maxX = Math.max(...projectedXs, 0);
  const horizontalCenter = (minX + maxX) / 2;
  const lastRow = nodes.reduce((max, node) => Math.max(max, node.gridPosition.row), 0);
  const height = lastRow * metrics.verticalStep + metrics.height;
  const positions = new Map<string, { x: number; y: number; position: LabyrinthGridPosition }>();
  for (const node of nodes) {
    positions.set(node.id, {
      x: availableWidth / 2 + (projectedX(node.gridPosition, metrics.radius) - horizontalCenter),
      y: node.gridPosition.row * metrics.verticalStep + metrics.height / 2,
      position: node.gridPosition,
    });
  }
  return { metrics, height, positions };
}

export function inspectorPlacement(
  x: number,
  y: number,
  hexWidth: number,
  mapWidth: number,
): { left: number; top: number; side: "left" | "right" } {
  const gap = 12;
  const inspectorWidth = LABYRINTH_MAP_UI.inspectorWidthPx;
  const right = x + hexWidth / 2 + gap;
  if (right + inspectorWidth <= mapWidth) {
    return { left: right, top: y, side: "right" };
  }
  return {
    left: Math.max(0, x - hexWidth / 2 - gap - inspectorWidth),
    top: y,
    side: "left",
  };
}
