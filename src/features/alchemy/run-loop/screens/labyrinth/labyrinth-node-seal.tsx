import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

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

export function LabyrinthNodeSeal({ node, map, selected, x, y, width, height, onSelect }: Props) {
  const visual = labyrinthNodeVisualState(map, node.id);
  const reachable = visual === "reachable";
  const cleared = visual === "cleared";
  const meta = LABYRINTH_NODE_META[node.type];
  const art = node.enemyId && isEnemyId(node.enemyId) ? enemyById[node.enemyId].art : meta.art;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reducedMotion = useReducedMotion();
  const previousVisual = useRef(visual);
  const pulseRef = useRef<SVGSVGElement>(null);
  const colors = reachable && !selected ? SHINE_PALETTES.labyrinth[node.type] : null;
  const zIndex = reachable ? (hovered ? 30 : focused ? 20 : selected ? 10 : 1) : 0;

  usePlasmaInteraction(
    reachable && !selected ? getLabyrinthNodePlasmaPair(node) : null,
    reachable && !selected && (hovered || focused),
  );

  useEffect(() => {
    const newlyReachable = previousVisual.current !== "reachable" && reachable;
    previousVisual.current = visual;
    if (!newlyReachable || reducedMotion) return;
    const animation = pulseRef.current?.animate([{ opacity: 0 }, { opacity: 0.72, offset: 0.35 }, { opacity: 0 }], {
      duration: 350,
      easing: "ease-out",
    });
    return () => animation?.cancel();
  }, [visual, reachable, reducedMotion]);

  return (
    <div
      className="group absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: x, top: y, width, height, zIndex }}
    >
      {reachable ? (
        <button
          type="button"
          data-labyrinth-node={node.id}
          aria-label={`${NODE_TYPE_LABELS[node.type]} chamber, reachable, enterable`}
          aria-pressed={selected}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(node.id);
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="absolute inset-0 z-10 cursor-pointer outline-none"
          style={{ clipPath: LABYRINTH_HEX_CLIP, WebkitTapHighlightColor: "transparent" }}
        />
      ) : null}
      <div
        data-testid={cleared ? "cleared-chamber" : !reachable ? "locked-chamber" : undefined}
        role={reachable ? undefined : "img"}
        aria-label={
          reachable ? undefined : `${NODE_TYPE_LABELS[node.type]} chamber, ${cleared ? "completed" : "locked"}`
        }
        aria-hidden={reachable ? true : undefined}
        className={cn(
          "pointer-events-none relative h-full w-full",
          reachable &&
            "labyrinth-node-art transition-[scale,translate,filter] duration-200 ease-out motion-reduce:transform-none motion-reduce:transition-none",
          selected && !reducedMotion && "-translate-y-0.5 scale-[1.035] drop-shadow-lg",
          reachable && !reducedMotion && "group-has-[:active]:translate-y-0 group-has-[:active]:scale-[0.97]",
          cleared && "scale-[0.97]",
        )}
      >
        <div
          className={cn("absolute inset-0 overflow-hidden bg-black", !reachable && !cleared && "opacity-[0.42]")}
          style={{ clipPath: LABYRINTH_HEX_CLIP }}
        >
          <img
            src={art}
            alt=""
            draggable={false}
            className={cn(
              "absolute inset-0 h-full w-full scale-[1.14] object-cover object-top",
              cleared && "opacity-[0.72] grayscale",
            )}
          />
          {cleared ? <span className="absolute inset-0 bg-black/[0.32]" /> : null}
        </div>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
          className={cn(
            "absolute inset-0 h-full w-full",
            selected ? "text-amber-400" : "text-white/15",
            reachable && "group-has-[:focus-visible]:text-amber-300",
          )}
        >
          {colors ? (
            <defs>
              <linearGradient id={`choice-shine-${node.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                {colors.map((color, index) => (
                  <stop
                    key={`${color}-${index}`}
                    offset={`${(index / Math.max(1, colors.length - 1)) * 100}%`}
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
          ) : null}
          <polygon
            points={HEX_POINTS}
            fill="none"
            stroke={colors ? `url(#choice-shine-${node.id})` : "currentColor"}
            strokeWidth={cleared ? 1.5 : reachable ? 3 : 2}
            strokeLinejoin="round"
          />
          {reachable ? (
            <polygon
              className="opacity-0 group-has-[:focus-visible]:opacity-100"
              points={HEX_POINTS}
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
            />
          ) : null}
        </svg>
        <svg
          ref={pulseRef}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
          className="absolute inset-0 h-full w-full text-amber-300 opacity-0"
        >
          <polygon points={HEX_POINTS} fill="none" stroke="currentColor" strokeWidth={3} />
        </svg>
      </div>
    </div>
  );
}
