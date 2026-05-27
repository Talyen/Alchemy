/**
 * Screen rendering the Labyrinth node connection grid and active modifiers tooltip.
 * Depends on: data.ts, modifiers.ts, screen-store.ts, Lucide icons, UI components
 * Depended on by: render-alchemy-screen.tsx
 */

import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { Crown, DoorOpen, FlaskConical, Heart, ShoppingCart, Skull, Sparkles, Star, Swords } from "lucide-react";

import { ShineBorder } from "@/components/ui/shine-border";
import { cn } from "@/lib/utils";
import type { LabyrinthMap, LabyrinthModifierKind, LabyrinthNodeType } from "@/lib/content-systems/types";
import { NODE_TYPE_LABELS } from "@/lib/content-systems/labyrinth/data";
import { ALL_LABYRINTH_MODIFIERS, REWARD_MODIFIER_KINDS } from "@/lib/content-systems/labyrinth/modifiers";
import { canEnterLabyrinthNode } from "@/lib/content-systems/labyrinth/map-generation";
import { keywordDefinitions } from "@/lib/game-data";
import { keywordAliases } from "../config";
import { HamburgerTrigger, ScreenHeader } from "../ui/shared-ui";
import { TooltipBody, TooltipHeader, TooltipSection } from "../ui/tooltip-panel";
import { useScreenStore } from "../stores/screen-store";

type Props = {
  onNodeClick: (row: number, col: number) => void;
  onOpenMenu: (rect?: DOMRect) => void;
};

type NodeMeta = {
  icon: React.ComponentType<{ className?: string }>;
  className: string;
  hoverBorder: string;
  shineColors: string[];
};

type HoveredLabyrinthNode = {
  row: number;
  col: number;
  type: LabyrinthNodeType;
  modifiers: LabyrinthModifierKind[];
  rewardModifiers: LabyrinthModifierKind[];
};

const CONFIG = {
  lineTrimOffset: 3.35,
  tooltipPadding: 8,
  mapGutter: 4.5,
  shineDuration: 10,
  shineBorderWidth: 2,
} as const;

const NODE_META: Record<LabyrinthNodeType, NodeMeta> = {
  entrance: {
    icon: DoorOpen,
    className: "bg-black text-stone-600",
    hoverBorder: "hover:border-stone-500",
    shineColors: ["#292524", "#57534e", "#a8a29e", "#44403c"],
  },
  combat: {
    icon: Swords,
    className: "bg-black text-red-500",
    hoverBorder: "hover:border-red-500",
    shineColors: ["#450a0a", "#dc2626", "#f87171", "#7f1d1d"],
  },
  elite: {
    icon: Skull,
    className: "bg-black text-violet-500",
    hoverBorder: "hover:border-violet-500",
    shineColors: ["#3b0764", "#9333ea", "#c084fc", "#581c87"],
  },
  rest: {
    icon: Heart,
    className: "bg-black text-orange-500",
    hoverBorder: "hover:border-orange-500",
    shineColors: ["#431407", "#d97706", "#fb923c", "#78350f"],
  },
  mystery: {
    icon: Sparkles,
    className: "bg-black text-zinc-400",
    hoverBorder: "hover:border-zinc-400",
    shineColors: ["#27272a", "#a1a1aa", "#e4e4e7", "#525252"],
  },
  shop: {
    icon: ShoppingCart,
    className: "bg-black text-yellow-500",
    hoverBorder: "hover:border-yellow-500",
    shineColors: ["#422006", "#eab308", "#fde047", "#78350f"],
  },
  alchemist: {
    icon: FlaskConical,
    className: "bg-black text-emerald-500",
    hoverBorder: "hover:border-emerald-500",
    shineColors: ["#022c22", "#10b981", "#6ee7b7", "#064e3b"],
  },
  boss: {
    icon: Crown,
    className: "bg-black text-red-400",
    hoverBorder: "hover:border-red-400",
    shineColors: ["#450a0a", "#b91c1c", "#fca5a5", "#7f1d1d"],
  },
};

const NODE_DESCRIPTIONS: Record<LabyrinthNodeType, string> = {
  entrance: "Where this descent began",
  combat: "Fight a standard enemy encounter",
  elite: "Face a stronger foe with extra danger",
  rest: "Recover before pressing deeper",
  mystery: "Encounter an unpredictable event",
  shop: "Spend gold on cards and services",
  alchemist: "Buy or mix potions",
  boss: "Challenge the Labyrinth guardian",
};

export function LabyrinthMapScreen({ onNodeClick, onOpenMenu }: Props) {
  const labyrinthMap = useScreenStore((s) => s.labyrinthMap);
  const [hoveredNode, setHoveredNode] = useState<HoveredLabyrinthNode | null>(null);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 overflow-hidden px-3 py-4 text-center sm:gap-5 sm:px-5 sm:py-6">
      <ScreenHeader title="Labyrinth" />
      <p className="max-w-xl text-sm text-amber-100/75">Choose your path through the depths</p>

      <section
        aria-label="Labyrinth map"
        className="relative w-full max-w-[920px] rounded-[22px] border border-stone-500 bg-stone-950 p-4 sm:p-5"
        style={{ "--labyrinth-node-size": "clamp(2.35rem, 4.8vw, 3.45rem)" } as CSSProperties}
      >
        <div className="absolute right-4 top-4 z-30">
          <HamburgerTrigger onClick={onOpenMenu} label="Open labyrinth menu" />
        </div>

        <div className="relative mx-auto aspect-[9/8] w-full max-w-[85.19cqh] p-[clamp(0.6rem,1.4vw,1rem)]">
          <div className="relative h-full w-full">
            <ConnectionLayer labyrinthMap={labyrinthMap} />

            {labyrinthMap.grid.map((row, r) =>
              row.map((node, c) =>
                node ? (
                  <LabyrinthNodeButton
                    key={`${r}-${c}`}
                    row={r}
                    col={c}
                    node={node}
                    labyrinthMap={labyrinthMap}
                    onNodeClick={onNodeClick}
                    onHover={setHoveredNode}
                    onLeave={() => setHoveredNode(null)}
                  />
                ) : null,
              ),
            )}

            {hoveredNode ? (
              <div
                key={`${hoveredNode.row}-${hoveredNode.col}`}
                className="pointer-events-none absolute z-[60] flex h-[var(--labyrinth-node-size)] w-[var(--labyrinth-node-size)] -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                style={positionStyle(hoveredNode.row, hoveredNode.col, labyrinthMap.rows, labyrinthMap.cols)}
              >
                <NodeTooltip
                  type={hoveredNode.type}
                  modifiers={hoveredNode.modifiers}
                  rewardModifiers={hoveredNode.rewardModifiers}
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function LabyrinthNodeButton({
  row,
  col,
  node,
  labyrinthMap,
  onNodeClick,
  onHover,
  onLeave,
}: {
  row: number;
  col: number;
  node: NonNullable<LabyrinthMap["grid"][number][number]>;
  labyrinthMap: LabyrinthMap;
  onNodeClick: (row: number, col: number) => void;
  onHover: (node: HoveredLabyrinthNode) => void;
  onLeave: () => void;
}) {
  const isCleared = node.state === "cleared";
  const isFailed = node.state === "failed";
  const isCurrent = node.state === "current";
  const isEnterable = canEnterLabyrinthNode(labyrinthMap, row, col);
  const meta = NODE_META[node.type];

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
      className="group/node absolute z-10 group-hover/node:z-50 flex h-[var(--labyrinth-node-size)] w-[var(--labyrinth-node-size)] -translate-x-1/2 -translate-y-1/2 items-center justify-center"
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
            borderWidth={CONFIG.shineBorderWidth}
            duration={CONFIG.shineDuration}
            shineColor={meta.shineColors}
          />
        ) : null}
        <span className="relative z-10">
          {(() => {
            const Icon = isCurrent ? Star : meta.icon;
            return (
              <Icon
                className={cn(
                  node.type === "boss" && !isCurrent ? "h-7 w-7" : "h-6 w-6",
                  isCurrent && "text-amber-400",
                )}
              />
            );
          })()}
        </span>
      </button>
    </div>
  );
}

function ConnectionLayer({ labyrinthMap }: { labyrinthMap: LabyrinthMap }) {
  const connections = getUniqueConnections(labyrinthMap);
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {connections.map((connection) => {
        const from = pointFor(connection.from.row, connection.from.col, labyrinthMap.rows, labyrinthMap.cols);
        const to = pointFor(connection.to.row, connection.to.col, labyrinthMap.rows, labyrinthMap.cols);
        const trimmed = trimLine(from, to, CONFIG.lineTrimOffset);
        return (
          <line
            key={`${connection.from.row}-${connection.from.col}-${connection.to.row}-${connection.to.col}`}
            x1={trimmed.from.x}
            y1={trimmed.from.y}
            x2={trimmed.to.x}
            y2={trimmed.to.y}
            stroke="#333"
            strokeWidth="0.3"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

function NodeTooltip({
  type,
  modifiers,
  rewardModifiers,
}: {
  type: LabyrinthNodeType;
  modifiers: LabyrinthModifierKind[];
  rewardModifiers: LabyrinthModifierKind[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [flip, setFlip] = useState(false);
  const [dx, setDx] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    if (rect.top < 0) setFlip(true);

    const padding = CONFIG.tooltipPadding;
    let horizontalShift = 0;
    if (rect.left < 0) {
      horizontalShift = -rect.left + padding;
    } else if (rect.right > window.innerWidth) {
      horizontalShift = window.innerWidth - rect.right - padding;
    }
    if (horizontalShift !== 0) setDx(horizontalShift);
  }, []);

  const enemyModifiers = modifiers.filter((m) => !REWARD_MODIFIER_KINDS.has(m));
  const hasModifiers = enemyModifiers.length > 0 || rewardModifiers.length > 0;

  return (
    <div
      ref={ref}
      className={cn(
        "pointer-events-none absolute left-1/2 z-50 w-[23.7cqh] -translate-x-1/2 rounded-[20px] border border-border/80 bg-card p-3 text-left",
        flip ? "top-[calc(100%+0.75rem)]" : "bottom-[calc(100%+0.75rem)]",
      )}
      style={dx !== 0 ? ({ marginLeft: dx } as CSSProperties) : undefined}
    >
      <TooltipHeader>{NODE_TYPE_LABELS[type]}</TooltipHeader>
      <TooltipBody>
        <p>{highlightKeywords(NODE_DESCRIPTIONS[type])}</p>
      </TooltipBody>
      {hasModifiers && (
        <>
          <TooltipSection label="Modifiers">
            <div className="grid gap-2 mt-1">
              {enemyModifiers.map((modifier) => {
                const definition = ALL_LABYRINTH_MODIFIERS[modifier];
                return (
                  <div key={modifier} className="rounded-lg border border-red-500/40 bg-white/[0.03] px-3.5 py-2.5">
                    <p className="text-xs font-bold text-amber-100">{definition.label}</p>
                    <p className="mt-0.5 text-sm leading-6 text-muted-foreground">
                      {highlightKeywords(definition.description)}
                    </p>
                  </div>
                );
              })}
              {rewardModifiers.map((modifier) => {
                const definition = ALL_LABYRINTH_MODIFIERS[modifier];
                return (
                  <div key={modifier} className="rounded-lg border border-emerald-500/40 bg-white/[0.03] px-3.5 py-2.5">
                    <p className="text-xs font-bold text-amber-100">{definition.label}</p>
                    <p className="mt-0.5 text-sm leading-6 text-muted-foreground">
                      {highlightKeywords(definition.description)}
                    </p>
                  </div>
                );
              })}
            </div>
          </TooltipSection>
        </>
      )}
    </div>
  );
}

// Wraps known game keywords in modifier description text with a colored span.
function highlightKeywords(text: string): ReactNode {
  const words = text.split(/(\s+)/);
  return words.map((word, index) => {
    const clean = word.replace(/[^a-zA-Z]/g, "");
    if (!clean) return word;
    const alias = keywordAliases.find((a) => a.match.toLowerCase() === clean.toLowerCase());
    const def = alias ? keywordDefinitions[alias.keywordId] : undefined;
    if (def) {
      return (
        <span key={index} className={cn(def.colorClass, "font-semibold")}>
          {word}
        </span>
      );
    }
    return word;
  });
}

function getNodeAriaLabel(type: LabyrinthNodeType, state: string, modifierCount: number, isEnterable: boolean) {
  const label = NODE_TYPE_LABELS[type];
  const modifiers =
    modifierCount === 0
      ? "no special modifiers"
      : `${modifierCount} special ${modifierCount === 1 ? "modifier" : "modifiers"}`;
  return `${label} chamber, ${state}, ${modifiers}${isEnterable ? ", enterable" : ""}`;
}

function getUniqueConnections(map: LabyrinthMap) {
  const seen = new Set<string>();
  const result: { from: { row: number; col: number }; to: { row: number; col: number } }[] = [];
  for (let row = 0; row < map.rows; row += 1) {
    for (let col = 0; col < map.cols; col += 1) {
      const node = map.grid[row]?.[col];
      if (!node) continue;
      for (const connection of node.connections) {
        const keyA = `${row},${col}`;
        const keyB = `${connection.row},${connection.col}`;
        const key = keyA < keyB ? `${keyA}-${keyB}` : `${keyB}-${keyA}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({ from: { row, col }, to: connection });
      }
    }
  }
  return result;
}

function pointFor(row: number, col: number, rows: number, cols: number) {
  const position = positionFor(row, col, rows, cols);
  return {
    x: position.left,
    y: position.top,
  };
}

function positionStyle(row: number, col: number, rows: number, cols: number): CSSProperties {
  const position = positionFor(row, col, rows, cols);
  return { left: `${position.left}%`, top: `${position.top}%` };
}

function positionFor(row: number, col: number, rows: number, cols: number) {
  const gutter = CONFIG.mapGutter;
  return {
    left: gutter + (col * (100 - gutter * 2)) / Math.max(1, cols - 1),
    top: gutter + (row * (100 - gutter * 2)) / Math.max(1, rows - 1),
  };
}

function trimLine(from: { x: number; y: number }, to: { x: number; y: number }, amount: number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  return {
    from: { x: from.x + ux * amount, y: from.y + uy * amount },
    to: { x: to.x - ux * amount, y: to.y - uy * amount },
  };
}
