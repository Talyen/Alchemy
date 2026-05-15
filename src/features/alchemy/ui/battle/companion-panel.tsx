// Companion card panel and tooltip for active battle allies.
// Depends on companion game-data types, card styling, and tilt utilities.
// Used by the battle actor section.
import { type CSSProperties } from "react";

import type { CompanionDefinition } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { cardSurfaceClass, popupClassName, staticCardTransform } from "../../config";
import { clearTiltFromEvent, setTiltFromEvent } from "../../utils";
import { DescriptionLines } from "../card-ui";

function getCompanionDescriptionLines(companion: CompanionDefinition, damageBonus: number): string[] {
  const attack = companion.turnStartEffects.find((effect) => effect.kind === "damage");
  if (!attack) return ["Acts at the start of each turn"];

  const baseDisplay = attack.damageType === "bleed" ? attack.amount * 2 : attack.amount;
  const displayAmount = baseDisplay + damageBonus;
  const displayType = attack.damageType.charAt(0).toUpperCase() + attack.damageType.slice(1);
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
          compact ? "w-[clamp(78px,17cqh,120px)]" : "w-[clamp(96px,11cqh,150px)]",
          shaking && "animate-shake",
        )}
        data-tilt-strength="10"
        onMouseMove={setTiltFromEvent}
        onMouseLeave={clearTiltFromEvent}
        style={{ "--card-base-transform": staticCardTransform } as CSSProperties}
      >
        <img
          src={companion.art}
          alt={companion.title}
          className="block w-full rounded-[30px] aspect-[3/4]"
          loading="eager"
        />
      </div>
      <div
        className={cn(
          popupClassName,
          "hover-popup-panel pointer-events-auto opacity-0 group-hover/companion:opacity-100",
        )}
      >
        <p className="text-sm text-foreground">{companion.title}</p>
        <DescriptionLines lines={getCompanionDescriptionLines(companion, damageBonus)} idPrefix={`companion-${companion.id}`} />
      </div>
    </div>
  );
}
