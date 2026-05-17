// Structured hover popup for enemy data in battle and bestiary collection.
// Depends on enemy formatting utilities and the shared popup class from layout config.
// Used by ArtPanel (battle) and CompendiumTile (collection) to show attacks and traits.
import { useLayoutEffect, useRef, useState } from "react";
import type { BestiaryEntry, EnemyAttackEffect } from "@/lib/game-data";
import type { LabyrinthModifierKind } from "@/lib/content-systems/types";
import { ALL_LABYRINTH_MODIFIERS } from "@/lib/content-systems/labyrinth/modifiers";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

import { popupClassName } from "../config";
import { formatEnemyAttackLines } from "../utils";
import { DescriptionLines } from "./card-ui";

export function EnemyTooltip({
  entry,
  discovered = true,
  attackEffects,
  labyrinthModifiers = [],
}: {
  entry: BestiaryEntry;
  discovered?: boolean;
  attackEffects?: EnemyAttackEffect[] | undefined;
  labyrinthModifiers?: LabyrinthModifierKind[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [flip, setFlip] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < 0) setFlip(true);
  }, []);

  const attackLines = formatEnemyAttackLines(attackEffects ?? entry.attackEffects);
  const traitLines = entry.traits.flatMap((t) => t.description.split("\n"));

  return (
    <div
      ref={ref}
      className={cn(
        flip
          ? "absolute left-[calc(100%+12px)] top-0 z-40 w-60 rounded-[20px] border border-border/80 bg-card px-3 py-3 text-left"
          : popupClassName,
        "pointer-events-auto",
      )}
      style={
        flip
          ? ({ transform: "translateY(6px) scale(0.985)", transformOrigin: "left center" } as CSSProperties)
          : undefined
      }
    >
      <p className="text-base text-foreground sm:text-lg">{discovered ? entry.title : "Undiscovered"}</p>
      <div className="mt-2 space-y-1 text-sm leading-6 text-muted-foreground">
        {discovered ? (
          [...attackLines, ...traitLines].map((line, i) => (
            <DescriptionLines key={`enemy-${entry.id}-${i}`} lines={[line]} idPrefix={`enemy-${entry.id}-${i}`} />
          ))
        ) : (
          <p>Undiscovered</p>
        )}
        {discovered && labyrinthModifiers.length > 0 ? (
          <div className="mt-3 border-t border-border/60 pt-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-100/80">
              Special Modifiers
            </p>
            {labyrinthModifiers.map((modifier) => {
              const definition = ALL_LABYRINTH_MODIFIERS[modifier];
              return (
                <p key={modifier}>
                  <span className="text-foreground">{definition.label}:</span> {definition.description}
                </p>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
