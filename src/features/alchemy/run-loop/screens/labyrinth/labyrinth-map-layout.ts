import type { LabyrinthNode } from "@/lib/content-systems/types";
import { LABYRINTH_GRID } from "@/lib/content-systems/labyrinth/grid";

export function layoutFloorNodes(nodes: LabyrinthNode[], availableWidth: number, availableHeight: number) {
  const { rows, sideColumns } = LABYRINTH_GRID;
  const columns = LABYRINTH_GRID.columns + 2 * sideColumns;
  const gap = Math.min(8, availableWidth / 16, availableHeight / 16);
  const inset = 8;
  const hoverAllowance = 0.06;
  const width = Math.max(
    0,
    Math.min(
      (availableWidth - inset * 2 - gap * (columns - 1)) / (columns + hoverAllowance),
      ((availableHeight - inset * 2 - gap * (rows - 1)) / (rows + hoverAllowance)) * (4 / 3),
    ),
  );
  const height = width * (3 / 4);
  const left = (availableWidth - columns * width - (columns - 1) * gap) / 2;
  const top = (availableHeight - rows * height - (rows - 1) * gap) / 2;
  const positions = new Map(
    nodes.map((node) => [
      node.id,
      {
        x: left + (node.gridPosition.col + sideColumns) * (width + gap) + width / 2,
        y: top + node.gridPosition.row * (height + gap) + height / 2,
      },
    ]),
  );
  return { metrics: { width, height }, positions };
}
