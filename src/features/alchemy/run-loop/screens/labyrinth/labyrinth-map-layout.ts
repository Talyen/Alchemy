import type { LabyrinthNode } from "@/lib/content-systems/types";
import { hexMetrics, projectedHalfColumn } from "@/lib/content-systems/labyrinth/hex-grid";

const HEX_CORNERS = [
  [0, -2],
  [1, -1],
  [1, 1],
  [0, 2],
  [-1, 1],
  [-1, -1],
] as const;

interface Point {
  x: number;
  y: number;
}

interface HexEdge {
  id: string;
  from: Point;
  to: Point;
  nodeIds: string[];
}

export function layoutFloorNodes(nodes: LabyrinthNode[], availableWidth: number, availableHeight: number) {
  const xs = nodes.map((node) => projectedHalfColumn(node.gridPosition));
  const ys = nodes.map((node) => node.gridPosition.row * 3);
  const minX = xs.length ? Math.min(...xs) - 1 : -1;
  const maxX = xs.length ? Math.max(...xs) + 1 : 1;
  const minY = ys.length ? Math.min(...ys) - 2 : -2;
  const maxY = ys.length ? Math.max(...ys) + 2 : 2;
  const padding = 12;
  const radius = Math.max(
    0,
    Math.min(
      (availableWidth - padding * 2) / (((maxX - minX) * Math.sqrt(3)) / 2),
      (availableHeight - padding * 2) / ((maxY - minY) / 2),
    ),
  );
  const metrics = hexMetrics(radius);
  const project = (x: number, y: number): Point => ({
    x: availableWidth / 2 + ((x - (minX + maxX) / 2) * metrics.width) / 2,
    y: availableHeight / 2 + ((y - (minY + maxY) / 2) * radius) / 2,
  });
  const positions = new Map<string, Point>();
  const edges = new Map<string, HexEdge>();
  for (const node of nodes) {
    const x = projectedHalfColumn(node.gridPosition);
    const y = node.gridPosition.row * 3;
    positions.set(node.id, project(x, y));
    for (let index = 0; index < HEX_CORNERS.length; index += 1) {
      const start = HEX_CORNERS[index]!;
      const end = HEX_CORNERS[(index + 1) % HEX_CORNERS.length]!;
      const a = `${x + start[0]},${y + start[1]}`;
      const b = `${x + end[0]},${y + end[1]}`;
      const id = [a, b].sort().join(":");
      const edge = edges.get(id);
      if (edge) edge.nodeIds.push(node.id);
      else
        edges.set(id, {
          id,
          from: project(x + start[0], y + start[1]),
          to: project(x + end[0], y + end[1]),
          nodeIds: [node.id],
        });
    }
  }
  return { metrics, positions, edges: [...edges.values()] };
}
