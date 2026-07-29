// Companion card panel and tooltip for active battle allies.
// Depends on companion game-data types, card styling, and tilt utilities.
// Used by the battle actor section.
import type { CompanionDefinition } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { cardSurfaceClass } from "../../config";
import { formatCompanionTurnStartLine } from "@/features/alchemy/shared/utils";
import { DescriptionLines } from "../card-description-ui";
import { TiltSurface } from "../tilt-surface";
import { TooltipPanel } from "../tooltip-panel";

function getCompanionDescriptionLines(companion: CompanionDefinition, damageBonus: number): string[] {
  const turnEffect = companion.turnStartEffects[0];
  if (!turnEffect) return ["Acts at the start of each turn"];

  const line = formatCompanionTurnStartLine(turnEffect, { damageBonus });
  return line ? [line] : ["Acts at the start of each turn"];
}

// Shows the active companion with enough tooltip detail to explain its automatic attack.
export function CompanionPanel({
  companion,
  compact = false,
  shaking = false,
  damageBonus = 0,
}: {
  companion: CompanionDefinition;
  compact?: boolean;
  shaking?: boolean;
  damageBonus?: number;
}) {
  return (
    <div
      className="companion-enter group/companion relative"
      data-testid="active-companion"
      aria-label={`Active companion: ${companion.title}`}
    >
      <TiltSurface
        className={cn(
          cardSurfaceClass,
          compact ? "w-[clamp(10.71cqh,21cqh,16.46cqh)]" : "w-[clamp(10.98cqh,13.59cqh,17.16cqh)]",
          shaking && "animate-shake",
        )}
      >
        <img
          src={companion.art}
          alt={companion.title}
          className="block aspect-[3/4] w-full rounded-shell-hero"
          loading="eager"
        />
      </TiltSurface>
      <TooltipPanel className="opacity-0 group-hover/companion:opacity-100">
        <p className="font-sans text-base font-bold text-amber-100/75">{companion.title}</p>
        <DescriptionLines
          lines={getCompanionDescriptionLines(companion, damageBonus)}
          idPrefix={`companion-${companion.id}`}
        />
      </TooltipPanel>
    </div>
  );
}
