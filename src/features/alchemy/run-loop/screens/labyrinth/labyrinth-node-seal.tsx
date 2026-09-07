import { useState, type CSSProperties } from "react";

import { NODE_TYPE_LABELS } from "@/lib/content-systems/labyrinth/data";
import { labyrinthNodeVisualState } from "@/lib/content-systems/labyrinth/map-state";
import type { LabyrinthMap, LabyrinthNode } from "@/lib/content-systems/types";
import { LABYRINTH_HEX_CLIP, LABYRINTH_NODE_META } from "@/features/alchemy/shared/config";
import { enemyById, isEnemyId } from "@/features/alchemy/shared/config/game-data-catalog";
import { SHINE_PALETTES } from "@/features/alchemy/shared/config/shine-palettes";
import { usePlasmaInteraction } from "@/features/alchemy/shared/ui/use-plasma-source";
import { cn } from "@/lib/utils";
import { getLabyrinthNodePlasmaPair } from "./labyrinth-plasma";

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
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const typeLabel = NODE_TYPE_LABELS[node.type];
  const isLocked = visual === "locked";
  const isCleared = visual === "cleared";
  const emphasized = hovered || focused || selected;
  const zIndex = hovered ? 30 : focused ? 20 : selected ? 10 : reachable ? 1 : 0;
  const strokeClass = selected ? "text-amber-400" : reachable ? typeStrokeClass(node.type) : "text-white/15";

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
  usePlasmaInteraction(hoverPlasmaPair, (hovered || focused) && reachable && !selected);

  if (isCleared) {
    return (
      <div
        data-testid="cleared-chamber"
        role="img"
        aria-label={`${typeLabel} chamber, completed`}
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 overflow-hidden"
        style={{ left: x, top: y, width, height, clipPath: LABYRINTH_HEX_CLIP }}
      >
        <img src={art} alt="" className="absolute inset-0 h-full w-full scale-[1.14] object-cover object-top" />
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full text-red-500/35"
        >
          <path
            d="M 25 25 L 75 75 M 75 25 L 25 75"
            fill="none"
            stroke="currentColor"
            strokeWidth={5}
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  return (
    <div
      className="group absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: x, top: y, width, height, zIndex }}
    >
      <button
        type="button"
        data-labyrinth-node={node.id}
        aria-label={`${typeLabel} chamber, ${visual}${reachable ? ", enterable" : ""}`}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(node.id);
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-pressed={selected}
        data-hovered={emphasized ? "true" : undefined}
        style={buttonStyle}
        className={cn(
          "relative block h-full w-full bg-black outline-none motion-reduce:transition-none",
          "cursor-pointer",
          isLocked && !emphasized && "opacity-[0.42]",
        )}
      >
        <span className="pointer-events-none absolute inset-0 overflow-hidden" style={{ clipPath: LABYRINTH_HEX_CLIP }}>
          <img
            src={art}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-[1.14] object-cover object-top"
          />
          {!emphasized ? <span className="absolute inset-0 bg-black/25" /> : null}
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
              points={HEX_POINTS}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              shapeRendering="geometricPrecision"
            />
          </svg>
        ) : null}
        {reachableShineColors ? (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible transition-[stroke-width] duration-200 group-hover:[&_polygon]:[stroke-width:3] group-has-[:focus-visible]:[&_polygon]:[stroke-width:3]"
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
              points={HEX_POINTS}
              fill="none"
              stroke={`url(#choice-shine-${node.id})`}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              shapeRendering="geometricPrecision"
            />
          </svg>
        ) : null}
      </button>
    </div>
  );
}
