// Companion card panel and tooltip for active battle allies.
// Depends on companion game-data types, card styling, and tilt utilities.
// Used by the battle actor section.
import { formatCompanionTurnStartLine, type CompanionDefinition } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { battleCompanionWidthClass, cardSurfaceClass } from "../../config";
import { TooltipHeader } from "../tooltip-panel";
import { PortaledTooltip } from "../portaled-tooltip";
import { useHoverVisible } from "../use-hover-visible";
import { DescriptionLines } from "../card-description-ui";
import { TiltSurface } from "../tilt-surface";

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
  const { triggerRef, visible, onMouseEnter, onMouseLeave } = useHoverVisible<HTMLDivElement>();

  return (
    <div
      ref={triggerRef}
      className="companion-enter relative"
      data-testid="active-companion"
      aria-label={`Active companion: ${companion.title}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <TiltSurface
        className={cn(
          cardSurfaceClass,
          compact ? "w-[clamp(10.71cqh,21cqh,16.46cqh)]" : battleCompanionWidthClass,
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
      <PortaledTooltip triggerRef={triggerRef} visible={visible}>
        <TooltipHeader>{companion.title}</TooltipHeader>
        <DescriptionLines
          lines={getCompanionDescriptionLines(companion, damageBonus)}
          idPrefix={`companion-${companion.id}`}
        />
      </PortaledTooltip>
    </div>
  );
}
