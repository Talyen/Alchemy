// Hex seal for a single labyrinth node: art clip, state chrome, reachable pulse.
import { Check } from "lucide-react";

import { ShineBorder } from "@/components/ui/shine-border";
import { NODE_TYPE_LABELS } from "@/lib/content-systems/labyrinth/data";
import { labyrinthNodeVisualState } from "@/lib/content-systems/labyrinth/map-state";
import type { LabyrinthMap, LabyrinthNode } from "@/lib/content-systems/types";
import { LABYRINTH_MAP_UI } from "@/lib/game-constants";
import { cn } from "@/lib/utils";

import { LABYRINTH_HEX_CLIP, LABYRINTH_NODE_META } from "@/features/alchemy/shared/config";
import { enemyById, isEnemyId } from "@/features/alchemy/shared/config/game-data-catalog";

interface Props {
  node: LabyrinthNode;
  map: LabyrinthMap;
  selected: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  onSelect: (nodeId: string) => void;
  onDeselect: () => void;
  onEnter: () => void;
}

export function LabyrinthNodeSeal({ node, map, selected, x, y, width, height, onSelect, onDeselect, onEnter }: Props) {
  const visual = labyrinthNodeVisualState(map, node.id);
  const meta = LABYRINTH_NODE_META[node.type];
  const Icon = meta.icon;
  const reachable = visual === "reachable";
  const art = node.enemyId && isEnemyId(node.enemyId) ? enemyById[node.enemyId].art : meta.art;

  return (
    <div className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: x, top: y, width, height }}>
      <button
        type="button"
        disabled={visual === "cleared"}
        aria-label={`${NODE_TYPE_LABELS[node.type]} chamber, ${visual}${reachable ? ", enterable" : ""}`}
        onClick={(event) => {
          event.stopPropagation();
          if (!reachable) {
            onDeselect();
            return;
          }
          if (selected) onEnter();
          else onSelect(node.id);
        }}
        className={cn(
          "relative h-full w-full overflow-hidden border-2 transition-[transform,opacity,border-color] duration-150",
          selected ? "z-20 scale-105 border-amber-400" : "border-white/20",
          reachable && !selected && "border-amber-200/80",
          visual === "locked" && "cursor-default opacity-40",
          visual === "cleared" && "cursor-default border-emerald-300/80 opacity-80",
        )}
        style={{ clipPath: LABYRINTH_HEX_CLIP }}
      >
        <img src={art} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
        <span className="absolute inset-0 bg-black/35" />
        {reachable ? (
          <ShineBorder
            borderWidth={LABYRINTH_MAP_UI.shineBorderWidth}
            duration={LABYRINTH_MAP_UI.shineDuration}
            shineColor={meta.shineColors}
          />
        ) : null}
        <span
          className={cn(
            "relative z-10 flex items-center justify-center",
            meta.className
              .split(" ")
              .filter((token) => token.startsWith("text-"))
              .join(" "),
          )}
        >
          {visual === "cleared" ? (
            <Check className="h-7 w-7 text-emerald-300" />
          ) : (
            <Icon className="h-7 w-7 drop-shadow" />
          )}
        </span>
      </button>
    </div>
  );
}
