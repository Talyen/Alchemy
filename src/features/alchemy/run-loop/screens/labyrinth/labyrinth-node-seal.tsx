import { NODE_TYPE_LABELS } from "@/lib/content-systems/labyrinth/data";
import { labyrinthNodeVisualState } from "@/lib/content-systems/labyrinth/map-state";
import type { LabyrinthMap, LabyrinthNode } from "@/lib/content-systems/types";
import { LABYRINTH_HEX_CLIP, LABYRINTH_NODE_META } from "@/features/alchemy/shared/config";
import { enemyById, isEnemyId } from "@/features/alchemy/shared/config/game-data-catalog";
import { cn } from "@/lib/utils";

interface Props {
  node: LabyrinthNode;
  map: LabyrinthMap;
  selected: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  onSelect: (nodeId: string) => void;
  onHover: (nodeId: string | null) => void;
  onFocus: (nodeId: string | null) => void;
}

export function LabyrinthNodeSeal({ node, map, selected, x, y, width, height, onSelect, onHover, onFocus }: Props) {
  const visual = labyrinthNodeVisualState(map, node.id);
  const art =
    node.enemyId && isEnemyId(node.enemyId) ? enemyById[node.enemyId].art : LABYRINTH_NODE_META[node.type].art;
  const status = visual === "reachable" ? "reachable, enterable" : visual === "cleared" ? "completed" : "unexplored";
  const current = node.id === map.currentNodeId;

  return (
    <button
      type="button"
      data-labyrinth-node={node.id}
      data-state={visual}
      aria-current={current ? "location" : undefined}
      aria-label={`${NODE_TYPE_LABELS[node.type]} chamber, ${status}${current ? ", you are here" : ""}`}
      aria-pressed={selected}
      onClick={() => onSelect(node.id)}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onFocus(node.id)}
      onBlur={() => onFocus(null)}
      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer overflow-hidden bg-black outline-none"
      style={{ left: x, top: y, width, height, clipPath: LABYRINTH_HEX_CLIP, WebkitTapHighlightColor: "transparent" }}
    >
      <img
        src={art}
        alt=""
        draggable={false}
        className={cn(
          "pointer-events-none h-full w-full scale-[1.14] object-cover object-top",
          visual === "cleared" && "opacity-60 grayscale",
          visual === "locked" && "opacity-[0.42]",
        )}
      />
    </button>
  );
}
