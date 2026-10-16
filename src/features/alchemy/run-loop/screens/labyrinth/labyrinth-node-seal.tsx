import { useGameTranslation } from "@/components/use-game-translation";

import { memo } from "react";
import { ShineBorder } from "@/components/ui/shine-border";
import { SHINE_PALETTES } from "@/features/alchemy/shared/config/shine-palettes";
import { Surface } from "@/features/alchemy/shared/ui/surface";
import { useInteractiveCard } from "@/features/alchemy/shared/ui/use-interactive-card";
import { LABYRINTH_GRID } from "@/lib/content-systems/labyrinth/grid";
import { NODE_TYPE_LABELS } from "@/lib/content-systems/labyrinth/data";
import { labyrinthNodeVisualState } from "@/lib/content-systems/labyrinth/map-state";
import type { LabyrinthMap, LabyrinthNode } from "@/lib/content-systems/types";
import { LABYRINTH_NODE_META } from "@/features/alchemy/shared/config/labyrinth-map";
import { enemyById, isEnemyId, labyrinthShroudedArt } from "@/features/alchemy/shared/config/game-data-catalog";
import { hashStringToUint32 } from "@/lib/rng";
import { cn } from "@/lib/utils";

interface Props {
  node: LabyrinthNode;
  map: LabyrinthMap;
  heroArt: string;
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

export const LabyrinthNodeSeal = memo(function LabyrinthNodeSeal({
  node,
  map,
  heroArt,
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
  const i18n = useGameTranslation();
  const visual = labyrinthNodeVisualState(map, node.id);
  const discovered = visual !== "undiscovered";
  const current = node.id === map.currentNodeId;
  const colors = discovered ? SHINE_PALETTES.labyrinth[node.type] : SHINE_PALETTES.labyrinth.entrance;
  const art = current
    ? heroArt
    : discovered
      ? node.enemyId && isEnemyId(node.enemyId)
        ? enemyById[node.enemyId].art
        : LABYRINTH_NODE_META[node.type].art
      : // Node identity keeps fog stable across rerenders and saves without using gameplay RNG or encounter data.
        labyrinthShroudedArt[hashStringToUint32(node.id) % labyrinthShroudedArt.length]!;
  const { onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard("labyrinth", node.id);
  const status = current
    ? i18n.text("labyrinth.node-status-0", "you are here")
    : visual === "cleared"
      ? i18n.text("labyrinth.node-status-1", "completed")
      : visual === "reachable"
        ? i18n.text("labyrinth.node-status-2", "reachable, enterable")
        : i18n.text("labyrinth.node-status-3", "discovered, out of reach");
  const label = discovered
    ? i18n.text("ui.labyrinth-node-seal.msg1", "{{value0}} chamber, {{value1}}", {
        value0: i18n.displayText(NODE_TYPE_LABELS[node.type]),
        value1: i18n.displayText(status),
      })
    : i18n.text("ui.labyrinth-node-seal.msg2", "Undiscovered chamber, row {{value0}}, column {{value1}}", {
        value0: i18n.displayText(node.gridPosition.row + 1),
        value1: i18n.displayText(node.gridPosition.col + LABYRINTH_GRID.sideColumns + 1),
      });

  return (
    <div
      data-labyrinth-node={node.id}
      data-state={visual}
      data-current={current}
      className="labyrinth-node"
      data-emphasized={emphasized}
      style={{ left: x, top: y, width, height }}
    >
      <Surface
        as="button"
        ariaLabel={i18n.displayText(label)}
        ariaCurrent={current ? "location" : undefined}
        ariaPressed={selected}
        ariaDisabled={!discovered}
        onClick={() => {
          if (discovered) onSelect(node.id);
        }}
        onMouseEnter={() => {
          onHoverStart();
          onHover(node.id);
        }}
        onMouseLeave={() => {
          onHoverEnd();
          onHover(null);
        }}
        onFocus={() => {
          onHoverStart();
          onFocus(node.id);
        }}
        onBlur={() => {
          onHoverEnd();
          onFocus(null);
        }}
        shimmerActive={shimmerActive}
        shimmerToken={shimmerToken}
        shimmerRounded="rounded-shell-compact"
        overlay={
          emphasized ? (
            <ShineBorder shineColor={colors} borderWidth={2} className="z-20 motion-reduce:animate-none" />
          ) : null
        }
        className={cn(
          "card-art-frame aspect-[4/3] rounded-shell-compact",
          discovered ? "cursor-pointer" : "cursor-default",
          current ? "border-primary" : "border-border/80",
          emphasized && "has-shine-border",
          node.type === "boss" && "labyrinth-boss",
        )}
      >
        <img
          key={art}
          src={art}
          alt=""
          draggable={false}
          decoding="async"
          className={cn(
            "labyrinth-discovery",
            current && "labyrinth-hero-art",
            visual === "cleared" && !current && "opacity-60 grayscale",
            visual === "locked" && "opacity-80",
            (visual === "reachable" || visual === "locked") && "brightness-[0.9] saturate-[0.85]",
            visual === "undiscovered" && "brightness-[0.82] saturate-[0.8]",
          )}
        />
      </Surface>
    </div>
  );
});
