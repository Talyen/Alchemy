// Hover tooltip for a labyrinth map node, including modifier breakdown.
import type { CSSProperties } from "react";

import type { LabyrinthModifierKind, LabyrinthNodeType } from "@/lib/content-systems/types";
import { NODE_TYPE_LABELS, NODE_TYPE_TOOLTIPS } from "@/lib/content-systems/labyrinth/data";
import { ALL_LABYRINTH_MODIFIERS, REWARD_MODIFIER_KINDS } from "@/lib/content-systems/labyrinth/modifiers";
import { LABYRINTH_MAP_UI } from "@/lib/game-constants";
import { cn } from "@/lib/utils";

import { renderColoredKeywords } from "../../../shared/ui/card-description-ui";
import { TooltipBody, TooltipHeader, TooltipSection, useTooltipViewportClamp } from "../../../shared/ui/tooltip-panel";

type Props = {
  type: LabyrinthNodeType;
  modifiers: LabyrinthModifierKind[];
  rewardModifiers: LabyrinthModifierKind[];
};

function ModifierTooltipCard({ modifier, variant }: { modifier: LabyrinthModifierKind; variant: "enemy" | "reward" }) {
  const definition = ALL_LABYRINTH_MODIFIERS[modifier];
  return (
    <div
      className={cn(
        "rounded-lg bg-white/[0.03] px-3.5 py-2.5",
        variant === "enemy" ? "border border-red-500/40" : "border border-emerald-500/40",
      )}
    >
      <p className="text-xs font-bold text-amber-100">{definition.label}</p>
      <p className="mt-0.5 text-sm leading-6 text-muted-foreground">{renderColoredKeywords(definition.description)}</p>
    </div>
  );
}

export function LabyrinthNodeTooltip({ type, modifiers, rewardModifiers }: Props) {
  const { ref, flip, dx } = useTooltipViewportClamp(LABYRINTH_MAP_UI.tooltipPadding, [
    type,
    modifiers,
    rewardModifiers,
  ]);

  const enemyModifiers = modifiers.filter((m) => !REWARD_MODIFIER_KINDS.has(m));
  const hasModifiers = enemyModifiers.length > 0 || rewardModifiers.length > 0;

  return (
    <div
      ref={ref}
      className={cn(
        "pointer-events-none absolute left-1/2 z-50 w-[23.7cqh] -translate-x-1/2 rounded-shell-tooltip border border-border/80 bg-card p-3 text-left",
        flip ? "top-[calc(100%+0.75rem)]" : "bottom-[calc(100%+0.75rem)]",
      )}
      style={dx !== 0 ? ({ marginLeft: dx } as CSSProperties) : undefined}
    >
      <TooltipHeader>{NODE_TYPE_LABELS[type]}</TooltipHeader>
      <TooltipBody>
        <p>{renderColoredKeywords(NODE_TYPE_TOOLTIPS[type])}</p>
      </TooltipBody>
      {hasModifiers ? (
        <TooltipSection label="Modifiers">
          <div className="mt-1 grid gap-2">
            {enemyModifiers.map((modifier) => (
              <ModifierTooltipCard key={modifier} modifier={modifier} variant="enemy" />
            ))}
            {rewardModifiers.map((modifier) => (
              <ModifierTooltipCard key={modifier} modifier={modifier} variant="reward" />
            ))}
          </div>
        </TooltipSection>
      ) : null}
    </div>
  );
}
