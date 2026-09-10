import { useState } from "react";
import { ShineBorder } from "@/components/ui/shine-border";
import { SHINE_PALETTES } from "@/features/alchemy/shared/config/shine-palettes";
import { Surface } from "@/features/alchemy/shared/ui/surface";
import { useInteractiveCard } from "@/features/alchemy/shared/ui/use-interactive-card";
import { LABYRINTH_GRID } from "@/lib/content-systems/labyrinth/grid";
import { NODE_TYPE_LABELS } from "@/lib/content-systems/labyrinth/data";
import { labyrinthNodeVisualState } from "@/lib/content-systems/labyrinth/map-state";
import type { LabyrinthMap, LabyrinthNode } from "@/lib/content-systems/types";
import { LABYRINTH_NODE_META } from "@/features/alchemy/shared/config";
import { enemyById, isEnemyId } from "@/features/alchemy/shared/config/game-data-catalog";
import { cn } from "@/lib/utils";

interface Props {
  node: LabyrinthNode;
  map: LabyrinthMap;
  selected: boolean;
  emphasized: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  onSelect: (nodeId: string) => void;
  onHover: (nodeId: string | null) => void;
  onFocus: (nodeId: string | null) => void;
}

export function LabyrinthNodeSeal({
  node,
  map,
  selected,
  emphasized,
  x,
  y,
  width,
  height,
  onSelect,
  onHover,
  onFocus,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const visual = labyrinthNodeVisualState(map, node.id);
  const discovered = visual !== "undiscovered";
  const current = node.id === map.currentNodeId;
  const colors = discovered ? SHINE_PALETTES.labyrinth[node.type] : SHINE_PALETTES.labyrinth.entrance;
  const art = discovered
    ? node.enemyId && isEnemyId(node.enemyId)
      ? enemyById[node.enemyId].art
      : LABYRINTH_NODE_META[node.type].art
    : null;
  const { onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard("labyrinth", node.id);
  const status = current
    ? "you are here"
    : visual === "cleared"
      ? "completed"
      : visual === "reachable"
        ? "reachable, enterable"
        : "discovered, out of reach";
  const label = discovered
    ? `${NODE_TYPE_LABELS[node.type]} chamber, ${status}`
    : `Undiscovered chamber, row ${node.gridPosition.row + 1}, column ${node.gridPosition.col + LABYRINTH_GRID.sideColumns + 1}`;

  return (
    <div
      data-labyrinth-node={node.id}
      data-state={visual}
      className="labyrinth-node"
      data-emphasized={emphasized}
      style={{ left: x, top: y, width, height }}
    >
      <Surface
        as="button"
        ariaLabel={label}
        ariaCurrent={current ? "location" : undefined}
        ariaPressed={selected}
        ariaDisabled={!discovered}
        onClick={() => {
          if (discovered) onSelect(node.id);
        }}
        onMouseEnter={() => {
          onHoverStart();
          setHovered(true);
          onHover(node.id);
        }}
        onMouseLeave={() => {
          onHoverEnd();
          setHovered(false);
          onHover(null);
        }}
        onFocus={() => {
          onHoverStart();
          setFocused(true);
          onFocus(node.id);
        }}
        onBlur={() => {
          onHoverEnd();
          setFocused(false);
          onFocus(null);
        }}
        shimmerActive={shimmerActive}
        shimmerToken={shimmerToken}
        shimmerRounded="rounded-shell-compact"
        overlay={
          emphasized ? (
            <ShineBorder
              glow={hovered || focused}
              shineColor={colors}
              borderWidth={2.5}
              duration={3}
              className="z-20 motion-reduce:animate-none"
            />
          ) : null
        }
        className={cn(
          "card-art-frame aspect-[4/3] rounded-shell-compact",
          discovered ? "cursor-pointer" : "cursor-default",
          current ? "border-primary" : "border-border/80",
          node.type === "boss" && "labyrinth-boss",
        )}
      >
        {art ? (
          <img
            src={art}
            alt=""
            draggable={false}
            className={cn(
              "labyrinth-discovery",
              visual === "cleared" && "opacity-60 grayscale",
              visual === "locked" && "opacity-80",
            )}
          />
        ) : (
          <span aria-hidden className="labyrinth-unknown" style={{ fontSize: height * 0.3 }}>
            ?
          </span>
        )}
      </Surface>
    </div>
  );
}
