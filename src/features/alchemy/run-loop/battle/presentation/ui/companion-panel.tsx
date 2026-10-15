import { useGameTranslation } from "@/components/use-game-translation";
import { text as gameText, displayText } from "@/lib/localization/runtime";
import { CombatantFrame } from "./combatant-frame";
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
import { BattleSceneArtwork } from "../../../../shared/ui/battle-scene-artwork";
import { ArtTurnActiveBorder } from "./actor-panel-helpers";
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
  useGameTranslation();
  const {
    wrapperRef: triggerRef,
    visible,
    onMouseEnter,
    onMouseLeave,
    onFocusCapture,
    onBlurCapture,
  } = useHoverVisible({
    focusWithinGuard: true,
  });
  const resolvedShineColors = turnShineColors ?? getCompanionShineColors(companion);

  return (
    <div
      ref={triggerRef}
      className="companion-enter relative"
      data-testid="active-companion"
      data-scene-region="left"
      aria-label={gameText("ui.companion-panel.1", "Active companion: {{value0}}", {
        value0: displayText(companion.title),
      })}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
    >
      <CombatantStatusEffectPresentation keyword={ccKeyword}>
        <Surface
          as="button"
          ariaLabel={gameText("ui.companion-panel.2", "Inspect {{value0}}", { value0: displayText(companion.title) })}
          clipContents={false}
          className={cn(
            "combatant-art battle-scene-piece relative",
            cardSurfaceClass,
            cardHoverScaleClass,
            turnActive && "combatant-turn-active",
            compact ? "w-[calc(11.1105*var(--content-rem,1rem))]" : battleCompanionWidthClass,
            "border border-border/80",
            shaking && "animate-shake",
          )}
        >
          <CombatantFrame />
          <ArtTurnActiveBorder
            side="player"
            testId="turn-badge-companion"
            active={turnActive}
            shineColor={resolvedShineColors}
          />
          <BattleSceneArtwork>
            <img
              src={companion.art}
              alt={displayText(companion.title)}
              className="block aspect-[3/4] w-full rounded-shell-hero"
              loading="eager"
              decoding="async"
            />
          </BattleSceneArtwork>
        </Surface>
      </CombatantStatusEffectPresentation>
      <PortaledTooltip
        triggerRef={triggerRef}
        visible={visible}
        plasmaColorPair={getPlasmaColorPairForCompanion(companion)}
      >
        <TooltipHeader>{displayText(companion.title)}</TooltipHeader>
        <DescriptionLines
          lines={getCompanionDescriptionLines(companion, bondLevel, damageBonus)}
          idPrefix={`companion-${companion.id}`}
        />
      </PortaledTooltip>
    </div>
  );
}
