// Structured hover popup for enemy data in battle and bestiary collection.
// Depends on enemy formatting utilities and the shared popup class from layout config.
// Used by ArtPanel (battle) and CompendiumTile (collection) to show attacks and traits.
import type { BestiaryEntry } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { popupClassName } from "../config";
import { formatEnemyAttackLines } from "../utils";
import { DescriptionLines } from "./card-ui";

export function EnemyTooltip({ entry, discovered = true }: { entry: BestiaryEntry; discovered?: boolean }) {
  const attackLines = formatEnemyAttackLines(entry.attackEffects);
  const traitLines = entry.traits.flatMap((t) => t.description.split("\n"));

  return (
    <div className={cn(popupClassName, "hover-popup-panel pointer-events-auto")}>
      <p className="text-base text-foreground sm:text-lg">{discovered ? entry.title : "Undiscovered"}</p>
      <div className="mt-2 space-y-1 text-sm leading-6 text-muted-foreground">
        {discovered
          ? [...attackLines, ...traitLines].map((line, i) => (
              <DescriptionLines key={`enemy-${entry.id}-${i}`} lines={[line]} idPrefix={`enemy-${entry.id}-${i}`} />
            ))
          : <p>Undiscovered</p>}
      </div>
    </div>
  );
}
