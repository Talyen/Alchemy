import type { LabyrinthNode } from "@/lib/content-systems/types";
import { hexMetrics, projectedX } from "@/lib/content-systems/labyrinth/hex-grid";

const HOVER_PADDING_SCALE = 1.08;

export function layoutFloorNodes(nodes: LabyrinthNode[], availableWidth: number, availableHeight: number) {
  const unit = hexMetrics(1);
  const xs = nodes.map((node) => projectedX(node.gridPosition, 1));
  const ys = nodes.map((node) => node.gridPosition.row * unit.verticalStep);
  const minX = xs.length ? Math.min(...xs) : 0;
  const maxX = xs.length ? Math.max(...xs) : 0;
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxY = ys.length ? Math.max(...ys) : 0;
  const radius = Math.max(
    0,
    Math.min(
      availableWidth / (maxX - minX + unit.width * HOVER_PADDING_SCALE),
      availableHeight / (maxY - minY + unit.height * HOVER_PADDING_SCALE),
    ),
  );
  const metrics = hexMetrics(radius);
  const positions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    positions.set(node.id, {
      x: availableWidth / 2 + (projectedX(node.gridPosition, 1) - (minX + maxX) / 2) * radius,
      y: availableHeight / 2 + (node.gridPosition.row * unit.verticalStep - (minY + maxY) / 2) * radius,
    });
  }
  return { metrics, positions };
}
