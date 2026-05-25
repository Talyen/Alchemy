// Structured hover popup for enemy data in battle and bestiary collection.
// Depends on enemy formatting utilities and the shared tooltip panel.
// Used by ArtPanel (battle) and CompendiumTile (collection) to show attacks and traits.
import type { BestiaryEntry, EnemyAttackEffect } from "@/lib/game-data";
import type { LabyrinthModifierKind } from "@/lib/content-systems/types";
import { ALL_LABYRINTH_MODIFIERS } from "@/lib/content-systems/labyrinth/modifiers";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

import { popupClassName } from "../config";
import { formatEnemyAttackLines } from "../utils";
import { DescriptionLines } from "./card-description-ui";
import { TooltipBody, TooltipHeader, TooltipSection, TooltipSeparator, useTooltipFlip } from "./tooltip-panel";

const ENEMY_TOOLTIP_CONFIG = {
  flippedTransform: "translateY(6px) scale(0.985)",
  flippedTransformOrigin: "left center",
} as const;

export function EnemyTooltip({
  entry,
  discovered = true,
  attackEffects,
  labyrinthModifiers = [],
  className,
}: {
  entry: BestiaryEntry;
  discovered?: boolean;
  attackEffects?: EnemyAttackEffect[] | undefined;
  labyrinthModifiers?: LabyrinthModifierKind[];
  className?: string;
}) {
  const { ref, flip } = useTooltipFlip();

  const attackLines = formatEnemyAttackLines(attackEffects ?? entry.attackEffects);
  const traitLines = entry.traits.flatMap((t) => t.description.split("\n"));

  const inner = (
    <>
      <TooltipHeader>{discovered ? entry.title : "Undiscovered"}</TooltipHeader>
      <TooltipBody>
        {discovered ? (
          [...attackLines, ...traitLines].map((line, i) => (
            <DescriptionLines key={`enemy-${entry.id}-${i}`} lines={[line]} idPrefix={`enemy-${entry.id}-${i}`} />
          ))
        ) : (
          <p>Undiscovered</p>
        )}
      </TooltipBody>
      {discovered && labyrinthModifiers.length > 0 ? (
        <>
          <TooltipSeparator />
          <TooltipSection label="Special Modifiers">
            {labyrinthModifiers.map((modifier) => {
              const definition = ALL_LABYRINTH_MODIFIERS[modifier];
              if (!definition) return null;
              return (
                <p key={modifier}>
                  <span className="font-semibold text-amber-100">{definition.label}:</span> {definition.description}
                </p>
              );
            })}
          </TooltipSection>
        </>
      ) : null}
    </>
  );

  if (flip) {
    return (
      <div
        ref={ref}
        className={cn(
          "pointer-events-none",
          "absolute left-[calc(100%+1.11cqh)] top-0 z-40 w-60 rounded-[20px] border border-border/80 bg-card px-3 py-3 text-left",
          className,
        )}
        style={
          {
            transform: ENEMY_TOOLTIP_CONFIG.flippedTransform,
            transformOrigin: ENEMY_TOOLTIP_CONFIG.flippedTransformOrigin,
          } as CSSProperties
        }
      >
        {inner}
      </div>
    );
  }

  return (
    <div ref={ref} className={cn(popupClassName, "w-60", "pointer-events-none", className)}>
      {inner}
    </div>
  );
}
