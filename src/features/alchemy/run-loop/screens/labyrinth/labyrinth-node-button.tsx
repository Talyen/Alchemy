// Single interactive node on the labyrinth map grid.
import { Star } from "lucide-react";

import { ShineBorder } from "@/components/ui/shine-border";
import type {
  EncounterCombatTraitId,
  EncounterRewardTraitId,
  LabyrinthMap,
  LabyrinthNodeType,
} from "@/lib/content-systems/types";
import { canEnterLabyrinthNode } from "@/lib/content-systems/labyrinth/map-generation";
import { NODE_TYPE_LABELS } from "@/lib/content-systems/labyrinth/data";
import { LABYRINTH_MAP_UI } from "@/lib/game-constants";
import { cn } from "@/lib/utils";

import { LABYRINTH_NODE_META } from "@/features/alchemy/shared/config";
import { positionStyle } from "./labyrinth-map-layout";

export interface HoveredLabyrinthNode {
  row: number;
  col: number;
  type: LabyrinthNodeType;
  modifiers: EncounterCombatTraitId[];
  rewardModifiers: EncounterRewardTraitId[];
}

interface Props {
  row: number;
  col: number;
  node: NonNullable<LabyrinthMap["grid"][number][number]>;
  labyrinthMap: LabyrinthMap;
  onNodeClick: (row: number, col: number) => void;
  onHover: (node: HoveredLabyrinthNode) => void;
  onLeave: () => void;
}

export function LabyrinthNodeButton({ row, col, node, labyrinthMap, onNodeClick, onHover, onLeave }: Props) {
  const isCurrent = node.state === "current";
  const isEnterable = canEnterLabyrinthNode(labyrinthMap, row, col);
  const meta = LABYRINTH_NODE_META[node.type];
  const Icon = isCurrent ? Star : meta.icon;
  const btnClasses = getNodeButtonClassName(meta, node, isCurrent, isEnterable);
  const iconClasses = getNodeIconClassName(node.type, isCurrent);

  const handleHover = () =>
    onHover({ row, col, type: node.type, modifiers: node.modifiers, rewardModifiers: node.rewardModifiers });
  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) onLeave();
  };

  return (
    <div
      className="group/node absolute z-10 flex h-[var(--labyrinth-node-size)] w-[var(--labyrinth-node-size)] -translate-x-1/2 -translate-y-1/2 items-center justify-center group-hover/node:z-50"
      style={positionStyle(row, col, labyrinthMap.rows, labyrinthMap.cols)}
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
        className={btnClasses}
      >
        {isEnterable ? (
          <ShineBorder
            borderWidth={LABYRINTH_MAP_UI.shineBorderWidth}
            duration={LABYRINTH_MAP_UI.shineDuration}
            shineColor={meta.shineColors}
          />
        ) : null}
        <span className="relative z-10">
          <Icon className={iconClasses} />
        </span>
      </button>
    </div>
  );
}

function getNodeIconClassName(nodeType: LabyrinthNodeType, isCurrent: boolean): string {
  const size = nodeType === "boss" && !isCurrent ? "h-8 w-8" : "h-7 w-7";
  return cn(size, isCurrent && "text-amber-400");
}

function getNodeButtonClassName(
  meta: { className: string; shineColors: string[] },
  node: { type: LabyrinthNodeType; state: string },
  isCurrent: boolean,
  isEnterable: boolean,
): string {
  return cn(
    "relative flex aspect-square h-full w-full items-center justify-center rounded-full border-2 text-sm transition-[transform,border-color] duration-150 [--tilt-frame-border-width:2px]",
    meta.className,
    isCurrent && "border-amber-400",
    isCurrent && node.type !== "entrance" && "shadow-labyrinth-current-glow",
    isEnterable && "hover:-translate-y-0.5 active:scale-95",
    node.state === "cleared" && "border-emerald-200 opacity-30",
    node.state === "failed" && "border-red-400 opacity-30",
    !isEnterable && "cursor-default border-2 border-white/20",
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
