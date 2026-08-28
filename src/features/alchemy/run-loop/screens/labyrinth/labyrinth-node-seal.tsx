import { Check } from "lucide-react";

import { NODE_TYPE_LABELS } from "@/lib/content-systems/labyrinth/data";
import { labyrinthNodeVisualState } from "@/lib/content-systems/labyrinth/map-state";
import type { LabyrinthMap, LabyrinthNode } from "@/lib/content-systems/types";
import { cardHoverScaleClass, LABYRINTH_HEX_CLIP, LABYRINTH_NODE_META } from "@/features/alchemy/shared/config";
import { enemyById, isEnemyId } from "@/features/alchemy/shared/config/game-data-catalog";
import { PortaledTooltip } from "@/features/alchemy/shared/ui/portaled-tooltip";
import { TooltipHeader, TooltipSubheader } from "@/features/alchemy/shared/ui/tooltip-panel";
import { useHoverVisible } from "@/features/alchemy/shared/ui/use-hover-visible";
import { cn } from "@/lib/utils";

const HEX_POINTS = "50,0 100,25 100,75 50,100 0,75 0,25";

interface Props {
  node: LabyrinthNode;
  map: LabyrinthMap;
  selected: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  onSelect: (nodeId: string) => void;
}

function typeStrokeClass(type: LabyrinthNode["type"]): string {
  return LABYRINTH_NODE_META[type].className
    .split(" ")
    .filter((token) => token.startsWith("text-"))
    .join(" ");
}

export function LabyrinthNodeSeal({ node, map, selected, x, y, width, height, onSelect }: Props) {
  const visual = labyrinthNodeVisualState(map, node.id);
  const meta = LABYRINTH_NODE_META[node.type];
  const reachable = visual === "reachable";
  const art = node.enemyId && isEnemyId(node.enemyId) ? enemyById[node.enemyId].art : meta.art;
  const { triggerRef, visible, onMouseEnter, onMouseLeave, onFocusCapture, onBlurCapture } =
    useHoverVisible<HTMLButtonElement>();
  const enemy = node.enemyId && isEnemyId(node.enemyId) ? enemyById[node.enemyId] : null;
  const typeLabel = NODE_TYPE_LABELS[node.type];
  const hoverTitle = enemy?.title ?? typeLabel;

  const zIndex = selected ? 2 : reachable ? 1 : 0;
  const strokeClass =
    visual === "cleared"
      ? "text-emerald-300"
      : selected
        ? "text-amber-400"
        : reachable
          ? typeStrokeClass(node.type)
          : "text-white/30";

  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: x, top: y, width, height, zIndex }}>
      <button
        ref={triggerRef}
        type="button"
        disabled={visual === "cleared"}
        aria-label={`${typeLabel} chamber, ${visual}${reachable ? ", enterable" : ""}`}
        onClick={(event) => {
          event.stopPropagation();
          if (visual === "cleared") return;
          onSelect(node.id);
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocusCapture={onFocusCapture}
        onBlurCapture={onBlurCapture}
        data-hovered={selected ? "true" : undefined}
        className={cn(
          cardHoverScaleClass,
          "relative h-full w-full cursor-pointer active:scale-[0.97]",
          selected && "-translate-y-0.5 shadow-[0_8px_16px_rgba(0,0,0,0.45)]",
          visual === "locked" && "opacity-[0.42]",
          visual === "cleared" && "cursor-default opacity-80",
        )}
      >
        <span className="absolute inset-0 overflow-hidden" style={{ clipPath: LABYRINTH_HEX_CLIP }}>
          <img src={art} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-top" />
          <span className="absolute inset-0 bg-black/25" />
        </span>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className={cn("pointer-events-none absolute inset-0 h-full w-full", strokeClass)}
          aria-hidden
        >
          <polygon
            points={HEX_POINTS}
            fill="none"
            vectorEffect="non-scaling-stroke"
            stroke="currentColor"
            strokeWidth={reachable || selected ? 3 : 2}
          />
          {reachable ? (
            <polygon
              points={HEX_POINTS}
              fill="none"
              vectorEffect="non-scaling-stroke"
              stroke="currentColor"
              strokeWidth={3}
              className="labyrinth-hex-pulse text-amber-200"
            />
          ) : null}
        </svg>
        {visual === "cleared" ? (
          <Check className="absolute inset-0 z-10 m-auto h-7 w-7 text-emerald-300 drop-shadow" />
        ) : null}
      </button>
      <PortaledTooltip triggerRef={triggerRef} visible={visible && !selected}>
        <TooltipHeader>{hoverTitle}</TooltipHeader>
        {enemy ? <TooltipSubheader className="mt-1">{typeLabel}</TooltipSubheader> : null}
      </PortaledTooltip>
    </div>
  );
}
