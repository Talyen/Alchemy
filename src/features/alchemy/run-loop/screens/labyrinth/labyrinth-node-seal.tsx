import { useState, type CSSProperties } from "react";

import { NODE_TYPE_LABELS } from "@/lib/content-systems/labyrinth/data";
import { labyrinthNodeVisualState } from "@/lib/content-systems/labyrinth/map-state";
import type { LabyrinthMap, LabyrinthNode } from "@/lib/content-systems/types";
import { cardHoverScaleClass, LABYRINTH_HEX_CLIP, LABYRINTH_NODE_META } from "@/features/alchemy/shared/config";
import { enemyById, isEnemyId } from "@/features/alchemy/shared/config/game-data-catalog";
import { SHINE_PALETTES } from "@/features/alchemy/shared/config/shine-palettes";
import { PortaledTooltip } from "@/features/alchemy/shared/ui/portaled-tooltip";
import { TooltipHeader, TooltipSubheader } from "@/features/alchemy/shared/ui/tooltip-panel";
import { useHoverVisible } from "@/features/alchemy/shared/ui/use-hover-visible";
import { usePlasmaInteraction } from "@/features/alchemy/shared/ui/use-plasma-source";
import { cn } from "@/lib/utils";
import { getLabyrinthNodePlasmaPair } from "./labyrinth-plasma";

const HEX_POINTS_INSET_1 = "50,1.8 98.2,26 98.2,74 50,98.2 1.8,74 1.8,26";
const LABYRINTH_HEX_CLIP_INSET_1 = "polygon(50% 1.8%, 98.2% 26%, 98.2% 74%, 50% 98.2%, 1.8% 74%, 1.8% 26%)";

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

  const isLocked = visual === "locked";
  const isCleared = visual === "cleared";
  const isSelectable = !isCleared;
  const isHovered = visible && isSelectable;
  const zIndex = selected ? 10 : isHovered ? 5 : reachable ? 1 : 0;
  const strokeClass =
    visual === "cleared"
      ? "text-emerald-300"
      : selected
        ? "text-amber-400"
        : reachable
          ? typeStrokeClass(node.type)
          : "text-white/15";

  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const reachableShineColors =
    reachable && !selected
      ? ([...(SHINE_PALETTES.labyrinth[node.type] ?? SHINE_PALETTES.talentDefault)] as readonly string[])
      : null;

  const hasShine = Boolean(reachableShineColors);
  const buttonStyle = {
    clipPath: LABYRINTH_HEX_CLIP,
    WebkitTapHighlightColor: "transparent",
  } satisfies CSSProperties;

  const hoverPlasmaPair = reachable && !isLocked && !isCleared && !selected ? getLabyrinthNodePlasmaPair(node) : null;
  usePlasmaInteraction(hoverPlasmaPair, visible && reachable && !selected);

  if (isCleared) return null;

  return (
    <div
      className="group absolute -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-300 ease-out"
      style={{ left: x, top: y, width, height, zIndex }}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={isCleared}
        tabIndex={isSelectable ? 0 : -1}
        aria-label={`${typeLabel} chamber, ${visual}${reachable ? ", enterable" : ""}`}
        onClick={(event) => {
          event.stopPropagation();
          if (!isSelectable) return;
          onSelect(node.id);
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocusCapture={onFocusCapture}
        onBlurCapture={onBlurCapture}
        data-hovered={selected ? "true" : undefined}
        style={buttonStyle}
        className={cn(
          isSelectable && cardHoverScaleClass,
          "relative h-full w-full outline-none",
          isSelectable && "cursor-pointer active:scale-[0.97]",
          isLocked && "opacity-[0.42]",
          !isSelectable && "cursor-default opacity-[0.42]",
        )}
      >
        <span className="absolute inset-0 overflow-hidden" style={{ clipPath: LABYRINTH_HEX_CLIP_INSET_1 }}>
          <img
            src={art}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-[1.14] object-cover object-top"
          />
          <span className="absolute inset-0 bg-black/25" />
        </span>
        {!hasShine ? (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className={cn(
              "pointer-events-none absolute inset-0 h-full w-full overflow-visible",
              strokeClass,
              "transition-[stroke,stroke-width] duration-200 group-hover:[stroke-width:3] group-has-[:focus-visible]:[stroke-width:3] group-has-[:focus-visible]:text-amber-300",
            )}
            aria-hidden
          >
            <polygon
              points={HEX_POINTS_INSET_1}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              shapeRendering="geometricPrecision"
            />
          </svg>
        ) : null}
      </button>
      {reachableShineColors ? (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full transition-[stroke-width] duration-200 group-hover:[&_polygon]:[stroke-width:3] group-has-[:focus-visible]:[&_polygon]:[stroke-width:3]"
          aria-hidden
        >
          <defs>
            <linearGradient
              id={`choice-shine-${node.id}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
              gradientUnits="objectBoundingBox"
            >
              {reachableShineColors.map((color, i) => (
                <stop
                  key={`${color}-${i}`}
                  offset={`${(i / Math.max(1, reachableShineColors.length - 1)) * 100}%`}
                  stopColor={color}
                />
              ))}
              {!reducedMotion ? (
                <>
                  <animate attributeName="x1" values="0%; -100%; 0%" dur="3s" repeatCount="indefinite" />
                  <animate attributeName="x2" values="100%; 0%; 100%" dur="3s" repeatCount="indefinite" />
                </>
              ) : null}
            </linearGradient>
          </defs>
          <polygon
            points={HEX_POINTS_INSET_1}
            fill="none"
            stroke={`url(#choice-shine-${node.id})`}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            shapeRendering="geometricPrecision"
          />
        </svg>
      ) : null}
      <PortaledTooltip triggerRef={triggerRef} visible={visible && !selected}>
        <TooltipHeader>{hoverTitle}</TooltipHeader>
        {enemy ? <TooltipSubheader className="mt-1">{typeLabel}</TooltipSubheader> : null}
      </PortaledTooltip>
    </div>
  );
}
