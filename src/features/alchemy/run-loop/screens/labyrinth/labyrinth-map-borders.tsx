import { useReducedMotion } from "motion/react";
import type { LabyrinthMap, LabyrinthNode } from "@/lib/content-systems/types";
import { labyrinthNodeVisualState } from "@/lib/content-systems/labyrinth/map-state";
import { SHINE_PALETTES } from "@/features/alchemy/shared/config/shine-palettes";
import type { layoutFloorNodes } from "./labyrinth-map-layout";

interface Props {
  map: LabyrinthMap;
  nodes: LabyrinthNode[];
  layout: ReturnType<typeof layoutFloorNodes>;
  selectedNodeId: string | null;
  focusedNodeId: string | null;
  hoveredNodeId: string | null;
}

export function LabyrinthMapBorders({ map, nodes, layout, selectedNodeId, focusedNodeId, hoveredNodeId }: Props) {
  const reducedMotion = useReducedMotion();
  const appearances = new Map(
    nodes.map((node) => {
      const state = labyrinthNodeVisualState(map, node.id);
      const selected = node.id === selectedNodeId;
      const current = node.id === map.currentNodeId;
      const focused = node.id === focusedNodeId;
      const hovered = node.id === hoveredNodeId;
      const priority = focused
        ? 6
        : selected
          ? 5
          : current
            ? 4
            : hovered
              ? 3
              : state === "reachable"
                ? 2
                : state === "cleared"
                  ? 1
                  : 0;
      const color =
        focused || selected
          ? "#ece6d5"
          : current
            ? "#b99454"
            : hovered
              ? "#a8a29e"
              : state === "cleared"
                ? "#484641"
                : "#2c2d2d";
      const colors = state === "reachable" && !selected && !focused ? SHINE_PALETTES.labyrinth[node.type] : null;
      return [node.id, { priority, color, colors }] as const;
    }),
  );
  const ownedEdges = layout.edges
    .map((edge) => {
      const owner = [...edge.nodeIds].sort(
        (a, b) => appearances.get(b)!.priority - appearances.get(a)!.priority || a.localeCompare(b),
      )[0]!;
      return { ...edge, owner, appearance: appearances.get(owner)! };
    })
    .sort((a, b) => a.appearance.priority - b.appearance.priority);

  return (
    <svg
      aria-hidden
      data-testid="labyrinth-borders"
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
    >
      <defs>
        {nodes.map((node) => {
          const colors = appearances.get(node.id)?.colors;
          const point = layout.positions.get(node.id);
          if (!colors || !point) return null;
          const left = point.x - layout.metrics.width / 2;
          const right = point.x + layout.metrics.width / 2;
          return (
            <linearGradient
              key={node.id}
              id={`choice-shine-${node.id}`}
              gradientUnits="userSpaceOnUse"
              x1={left}
              y1={point.y}
              x2={right}
              y2={point.y}
              spreadMethod="reflect"
            >
              {colors.map((color, index) => (
                <stop key={`${color}-${index}`} offset={`${(index / (colors.length - 1)) * 100}%`} stopColor={color} />
              ))}
              {!reducedMotion ? (
                <>
                  <animate
                    attributeName="x1"
                    values={`${left};${left - layout.metrics.width};${left}`}
                    dur="3s"
                    repeatCount="indefinite"
                  />
                  <animate attributeName="x2" values={`${right};${left};${right}`} dur="3s" repeatCount="indefinite" />
                </>
              ) : null}
            </linearGradient>
          );
        })}
      </defs>
      {ownedEdges.map((edge) => (
        <path
          key={edge.id}
          data-edge={edge.id}
          data-owner={edge.owner}
          d={`M ${edge.from.x} ${edge.from.y} L ${edge.to.x} ${edge.to.y}`}
          fill="none"
          stroke={edge.appearance.colors ? `url(#choice-shine-${edge.owner})` : edge.appearance.color}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
