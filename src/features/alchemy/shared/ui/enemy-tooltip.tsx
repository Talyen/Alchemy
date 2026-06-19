// Structured hover popup for enemy data in battle and bestiary collection.
// Depends on enemy formatting utilities and the shared tooltip panel.
// Used by ArtPanel (battle) and CompendiumTile (collection) to show attacks and traits.
import type { BestiaryEntry, EnemyAttackEffect } from "@/lib/game-data";
import type { LabyrinthModifierKind } from "@/lib/content-systems/types";
import { ALL_LABYRINTH_MODIFIERS } from "@/lib/content-systems/labyrinth/modifiers";
import { cn } from "@/lib/utils";

import { formatEnemyAttackLines } from "../utils";
import { DescriptionLines } from "./card-description-ui";
import {
  TooltipBody,
  TooltipHeader,
  TooltipPanel,
  TooltipSection,
  TooltipSeparator,
  useTooltipPlacementWithSideFallback,
} from "./tooltip-panel";

export function EnemyTooltip({
  entry,
  discovered = true,
  attackEffects,
  labyrinthModifiers = [],
  align = "right",
  className,
}: {
  entry: BestiaryEntry;
  discovered?: boolean;
  attackEffects?: EnemyAttackEffect[] | undefined;
  labyrinthModifiers?: LabyrinthModifierKind[];
  align?: "left" | "right";
  className?: string;
}) {
  const { ref, placement, flip, dx } = useTooltipPlacementWithSideFallback(align, 8, entry.id);

  const attackLines = formatEnemyAttackLines(attackEffects ?? entry.attackEffects);
  const separatelyDisplayedTraitIds = new Set<string>(labyrinthModifiers);
  const traitLines = entry.traits
    .filter((trait) => !separatelyDisplayedTraitIds.has(trait.id))
    .flatMap((trait) => trait.description.split("\n"));

  const isSide = placement === "side-start" || placement === "side-end";

  return (
    <TooltipPanel
      ref={ref}
      placement={isSide ? placement : "above"}
      flip={flip}
      width="w-60"
      className={cn(
        "rounded-shell-tooltip",
        isSide &&
          (align === "left"
            ? "absolute right-[calc(100%+1.11cqh)] top-0 bottom-auto left-auto"
            : "absolute left-[calc(100%+1.11cqh)] top-0 bottom-auto right-auto"),
        className,
      )}
      style={{
        ...(isSide ? { transform: "none" } : {}),
        ...(dx !== 0 ? { marginLeft: dx } : {}),
      }}
    >
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
    </TooltipPanel>
  );
}
