import { getCompanionDescriptionLines, type CompanionDefinition, type CompanionDamageModifiers } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import {
  battleCompanionWidthClass,
  cardHoverScaleClass,
  cardSurfaceClass,
  getCompanionShineColors,
  getPlasmaColorPairForCompanion,
} from "../../../../shared/config/index";
import { TooltipHeader } from "../../../../shared/ui/tooltips/tooltip-panel";
import { PortaledTooltip } from "../../../../shared/ui/tooltips/portaled-tooltip";
import { useHoverVisible } from "../../../../shared/ui/use-hover-visible";
import { DescriptionLines } from "../../../../shared/ui/cards/card-description-ui";
import { Surface } from "../../../../shared/ui/surface";
import { ArtHoverKeywordBorder, ArtTurnActiveBorder } from "./actor-panel-helpers";
import { CombatantStatusEffectPresentation } from "./combatant-status-effect-presentation";
import type { ActiveCcKeyword } from "../../../../shared/utils/cc-presentation";

export function CompanionPanel({
  companion,
  compact = false,
  shaking = false,
  damageBonus = 0,
  bondLevel = 0,
  ccKeyword = null,
  turnActive = false,
  turnShineColors,
}: {
  companion: CompanionDefinition;
  compact?: boolean;
  shaking?: boolean;
  damageBonus?: number | CompanionDamageModifiers;
  bondLevel?: number;
  ccKeyword?: ActiveCcKeyword | null;
  turnActive?: boolean;
  turnShineColors?: readonly string[];
}) {
  const { triggerRef, visible, onMouseEnter, onMouseLeave } = useHoverVisible();
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
        <Surface
          clipContents={false}
          className={cn(
            "relative",
            cardSurfaceClass,
            cardHoverScaleClass,
            turnActive && "combatant-turn-active",
            compact ? "w-[calc(11.1105*var(--content-rem,1rem))]" : battleCompanionWidthClass,
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
          <ArtHoverKeywordBorder active={visible} shineColor={getCompanionShineColors(companion)} />
          <img
            src={companion.art}
            alt={companion.title}
            className="block aspect-[3/4] w-full rounded-shell-hero"
            loading="eager"
          />
        </Surface>
      </CombatantStatusEffectPresentation>
      <PortaledTooltip
        triggerRef={triggerRef}
        visible={visible}
        plasmaColorPair={getPlasmaColorPairForCompanion(companion)}
      >
        <TooltipHeader>{companion.title}</TooltipHeader>
        <DescriptionLines
          lines={getCompanionDescriptionLines(companion, bondLevel, damageBonus)}
          idPrefix={`companion-${companion.id}`}
        />
      </PortaledTooltip>
    </div>
  );
}
