// Single interactive node on the labyrinth map grid.
import { Star } from "lucide-react";

import { ShineBorder } from "@/components/ui/shine-border";
import type { LabyrinthMap, LabyrinthModifierKind, LabyrinthNodeType } from "@/lib/content-systems/types";
import { canEnterLabyrinthNode } from "@/lib/content-systems/labyrinth/map-generation";
import { NODE_TYPE_LABELS } from "@/lib/content-systems/labyrinth/data";
import { LABYRINTH_MAP_UI } from "@/lib/game-constants";
import { cn } from "@/lib/utils";

import { LABYRINTH_NODE_META } from "../../config";
import { positionStyle } from "./labyrinth-map-layout";

export type HoveredLabyrinthNode = {
  row: number;
  col: number;
  type: LabyrinthNodeType;
  modifiers: LabyrinthModifierKind[];
  rewardModifiers: LabyrinthModifierKind[];
};

type Props = {
  row: number;
  col: number;
  node: NonNullable<LabyrinthMap["grid"][number][number]>;
  labyrinthMap: LabyrinthMap;
  onNodeClick: (row: number, col: number) => void;
  onHover: (node: HoveredLabyrinthNode) => void;
  onLeave: () => void;
};

export function LabyrinthNodeButton({ row, col, node, labyrinthMap, onNodeClick, onHover, onLeave }: Props) {
  const isCleared = node.state === "cleared";
  const isFailed = node.state === "failed";
  const isCurrent = node.state === "current";
  const isEnterable = canEnterLabyrinthNode(labyrinthMap, row, col);
  const meta = LABYRINTH_NODE_META[node.type];
  const Icon = isCurrent ? Star : meta.icon;

  const handleHover = () => {
    onHover({ row, col, type: node.type, modifiers: node.modifiers, rewardModifiers: node.rewardModifiers });
  };

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      onLeave();
    }
  };

  return (
    <div
      className="group/node absolute z-10 flex h-[var(--labyrinth-node-size)] w-[var(--labyrinth-node-size)] -translate-x-1/2 -translate-y-1/2 items-center justify-center group-hover/node:z-50"
      style={{ ...positionStyle(row, col, labyrinthMap.rows, labyrinthMap.cols), willChange: "transform" }}
      onPointerEnter={handleHover}
      onPointerLeave={onLeave}
      onFocusCapture={handleHover}
      onBlurCapture={handleBlur}
    >
      <button
        type="button"
        disabled={!isEnterable}
        aria-label={getNodeAriaLabel(node.type, node.state, node.modifiers.length, isEnterable)}
        onClick={() => onNodeClick(row, col)}
        className={cn(
          "relative flex aspect-square h-full w-full items-center justify-center rounded-full border-2 text-xs transition-[transform,border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950",
          meta.className,
          isCurrent && "border-amber-400",
          isCurrent && node.type !== "entrance" && "shadow-[0_0_10px_rgba(251,191,36,0.5)]",
          isEnterable && "hover:-translate-y-0.5 active:scale-95",
          isCleared && "border-emerald-200 opacity-30",
          isFailed && "border-red-400 opacity-30",
          !isEnterable && "cursor-default border-2 border-white/20",
        )}
      >
        {isEnterable ? (
          <ShineBorder
            borderWidth={LABYRINTH_MAP_UI.shineBorderWidth}
            duration={LABYRINTH_MAP_UI.shineDuration}
            shineColor={meta.shineColors}
          />
        ) : null}
        <span className="relative z-10">
          <Icon
            className={cn(node.type === "boss" && !isCurrent ? "h-7 w-7" : "h-6 w-6", isCurrent && "text-amber-400")}
          />
        </span>
      </button>
    </div>
  );
}

function getNodeAriaLabel(type: LabyrinthNodeType, state: string, modifierCount: number, isEnterable: boolean) {
  const label = NODE_TYPE_LABELS[type];
  const modifiers =
    modifierCount === 0
      ? "no special modifiers"
      : `${modifierCount} special ${modifierCount === 1 ? "modifier" : "modifiers"}`;
  return `${label} chamber, ${state}, ${modifiers}${isEnterable ? ", enterable" : ""}`;
}
