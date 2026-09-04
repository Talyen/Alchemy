import type { LabyrinthGridPosition, LabyrinthNode } from "@/lib/content-systems/types";
import { hexMetrics, hexRadius, projectedX } from "@/lib/content-systems/labyrinth/hex-grid";
import { LABYRINTH_MAP_UI } from "@/lib/game-constants";

const LABYRINTH_NODE_SCALE = 0.86;

export function layoutFloorNodes(nodes: LabyrinthNode[], availableWidth: number) {
  const packedWidth = hexMetrics(hexRadius(availableWidth)).width;
  const rawMetrics = hexMetrics(hexRadius(availableWidth, packedWidth / 2) * LABYRINTH_NODE_SCALE);
  const metrics = {
    ...rawMetrics,
    width: Math.round(rawMetrics.width / 2) * 2,
    height: Math.round(rawMetrics.height / 2) * 2,
    verticalStep: Math.round(rawMetrics.verticalStep / 2) * 2,
  };
  const visibleNodes = nodes.filter((node) => !node.cleared);
  const boundsNodes = visibleNodes.length > 0 ? visibleNodes : nodes;
  let minRow = 0;
  let horizontalCenter = 0;
  let height = metrics.height;
  if (boundsNodes.length > 0) {
    const projectedXs = boundsNodes.map((node) => projectedX(node.gridPosition, rawMetrics.radius));
    const minX = Math.min(...projectedXs);
    const maxX = Math.max(...projectedXs);
    horizontalCenter = (minX + maxX) / 2;
    minRow = boundsNodes.reduce((min, node) => Math.min(min, node.gridPosition.row), Number.POSITIVE_INFINITY);
    const maxRow = boundsNodes.reduce((max, node) => Math.max(max, node.gridPosition.row), Number.NEGATIVE_INFINITY);
    height = (maxRow - minRow) * metrics.verticalStep + metrics.height;
  }
  const positions = new Map<string, { x: number; y: number; position: LabyrinthGridPosition }>();
  for (const node of nodes) {
    positions.set(node.id, {
      x: Math.round(availableWidth / 2 + (projectedX(node.gridPosition, rawMetrics.radius) - horizontalCenter)),
      y: Math.round((node.gridPosition.row - minRow) * metrics.verticalStep + metrics.height / 2),
      position: node.gridPosition,
    });
  }
  return { metrics, height, positions };
}

export function clampInspectorTop(top: number, inspectorHeight: number, canvasHeight: number): number {
  if (inspectorHeight <= 0 || canvasHeight <= 0) return top;
  const half = inspectorHeight / 2;
  const minTop = half;
  const maxTop = Math.max(minTop, canvasHeight - half);
  return Math.min(Math.max(top, minTop), maxTop);
}

export function inspectorPlacement(
  x: number,
  y: number,
  hexWidth: number,
  mapWidth: number,
): { left: number; top: number; side: "left" | "right"; width: number } {
  const gap = 12;
  const width = Math.min(LABYRINTH_MAP_UI.inspectorWidthPx, Math.max(0, mapWidth - gap * 2));
  const right = x + hexWidth / 2 + gap;
  if (right + width <= mapWidth) {
    return { left: right, top: y, side: "right", width };
  }
  return {
    left: Math.max(0, x - hexWidth / 2 - gap - width),
    top: y,
    side: "left",
    width,
  };
}
