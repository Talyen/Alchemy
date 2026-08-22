// SVG connection lines between labyrinth map nodes.
import { useMemo } from "react";
import type { LabyrinthMap } from "@/lib/content-systems/types";
import { LABYRINTH_MAP_UI } from "@/lib/game-constants";

import { getUniqueConnections, positionFor, trimLine } from "./labyrinth-map-layout";

interface Props {
  labyrinthMap: LabyrinthMap;
}

export function LabyrinthConnectionLayer({ labyrinthMap }: Props) {
  const connections = useMemo(() => getUniqueConnections(labyrinthMap), [labyrinthMap]);
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {connections.map((connection) => {
        const from = positionFor(connection.from.row, connection.from.col, labyrinthMap.rows, labyrinthMap.cols);
        const to = positionFor(connection.to.row, connection.to.col, labyrinthMap.rows, labyrinthMap.cols);
        const trimmed = trimLine(
          { x: from.left, y: from.top },
          { x: to.left, y: to.top },
          LABYRINTH_MAP_UI.lineTrimOffset,
        );
        return (
          <line
            key={`${connection.from.row}-${connection.from.col}-${connection.to.row}-${connection.to.col}`}
            x1={trimmed.from.x}
            y1={trimmed.from.y}
            x2={trimmed.to.x}
            y2={trimmed.to.y}
            className="stroke-stone-700"
            strokeWidth="0.3"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}
