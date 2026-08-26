// Companion card panel and tooltip for active battle allies.
// Used by the battle actor section.
import { formatCompanionTurnStartLine, type CompanionDefinition } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import {
  battleCompanionWidthClass,
  cardSurfaceClass,
  getCompanionShineColors,
  getPlasmaColorPairForCompanion,
} from "../../config";
import { TooltipHeader } from "../tooltip-panel";
import { PortaledTooltip } from "../portaled-tooltip";
import { useHoverVisible } from "../use-hover-visible";
import { DescriptionLines } from "../card-description-ui";
import { TiltSurface } from "../tilt-surface";
import { ArtTurnActiveBorder } from "./actor-panel-helpers";
import { CombatantStatusEffectPresentation } from "./combatant-status-effect-presentation";
import type { ActiveCcKeyword } from "../../utils/cc-presentation";

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
  ccKeyword = null,
  turnActive = false,
  turnShineColors,
}: {
  companion: CompanionDefinition;
  compact?: boolean;
  shaking?: boolean;
  damageBonus?: number;
  ccKeyword?: ActiveCcKeyword | null;
  turnActive?: boolean;
  turnShineColors?: readonly string[];
}) {
  const { triggerRef, visible, onMouseEnter, onMouseLeave } = useHoverVisible<HTMLDivElement>();
  const resolvedShineColors = turnShineColors ?? getCompanionShineColors(companion);

  return (
    <div
      ref={triggerRef}
      className="companion-enter relative"
      data-testid="active-companion"
      aria-label={`Active companion: ${companion.title}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <CombatantStatusEffectPresentation keyword={ccKeyword}>
        <TiltSurface
          clipContents={false}
          className={cn(
            "relative",
            cardSurfaceClass,
            compact ? "w-[clamp(10.71cqh,21cqh,16.46cqh)]" : battleCompanionWidthClass,
            "border border-border/80",
            shaking && "animate-shake",
          )}
        >
          <ArtTurnActiveBorder
            side="player"
            testId="turn-badge-companion"
            active={turnActive}
            shineColor={resolvedShineColors}
          />
          <img
            src={companion.art}
            alt={companion.title}
            className="block aspect-[3/4] w-full rounded-shell-hero"
            loading="eager"
          />
        </TiltSurface>
      </CombatantStatusEffectPresentation>
      <PortaledTooltip
        triggerRef={triggerRef}
        visible={visible}
        plasmaColorPair={getPlasmaColorPairForCompanion(companion)}
      >
        <TooltipHeader>{companion.title}</TooltipHeader>
        <DescriptionLines
          lines={getCompanionDescriptionLines(companion, damageBonus)}
          idPrefix={`companion-${companion.id}`}
        />
      </PortaledTooltip>
    </div>
  );
}
