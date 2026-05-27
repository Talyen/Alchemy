// Companion card panel and tooltip for active battle allies.
// Depends on companion game-data types, card styling, and tilt utilities.
// Used by the battle actor section.
import { type CSSProperties } from "react";

import type { CompanionDefinition } from "@/lib/game-data";
import { cn, capitalizeWord } from "@/lib/utils";

import { cardSurfaceClass, staticCardTransform } from "../../config";
import { clearTiltFromEvent, setTiltFromEvent } from "../../utils";
import { DescriptionLines } from "../card-description-ui";
import { TooltipPanel } from "../tooltip-panel";

function getCompanionDescriptionLines(companion: CompanionDefinition, damageBonus: number): string[] {
  const attack = companion.turnStartEffects.find((effect) => effect.kind === "damage");
  if (!attack) return ["Acts at the start of each turn"];

  const totalAmount = attack.amount + damageBonus;
  const displayAmount = attack.damageType === "bleed" ? totalAmount * 2 : totalAmount;
  const displayType = capitalizeWord(attack.damageType);
  return [`Deals ${displayAmount} ${displayType} damage each turn`];
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
      <div
        className={cn(
          "tilt-surface",
          cardSurfaceClass,
          compact ? "w-[clamp(10.71cqh,21cqh,16.46cqh)]" : "w-[clamp(10.98cqh,13.59cqh,17.16cqh)]",
          shaking && "animate-shake",
        )}
        onMouseMove={setTiltFromEvent}
        onMouseLeave={clearTiltFromEvent}
        style={{ "--card-base-transform": staticCardTransform } as CSSProperties}
      >
        <img
          src={companion.art}
          alt={companion.title}
          className="block w-full rounded-shell-hero aspect-[3/4]"
          loading="eager"
        />
      </div>
      <TooltipPanel className="opacity-0 group-hover/companion:opacity-100">
        <p className="font-display text-base font-bold text-amber-100/75">{companion.title}</p>
        <DescriptionLines
          lines={getCompanionDescriptionLines(companion, damageBonus)}
          idPrefix={`companion-${companion.id}`}
        />
      </TooltipPanel>
    </div>
  );
}
