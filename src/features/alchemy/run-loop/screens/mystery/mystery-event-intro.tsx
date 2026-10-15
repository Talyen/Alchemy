import { useGameTranslation } from "@/components/use-game-translation";
import { displayText } from "@/lib/localization/runtime";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextAnimate } from "@/components/ui/text-animate";
import { type BattleCard, type TrinketEntry } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import {
  bodyTextClass,
  cardInteractiveGlowClass,
  cardSurfaceClass,
  getCardInspectionShineColors,
  landscapeArtImageClass,
  standaloneLandscapeArtWidthClass,
  viewCardWidthClass,
} from "@/features/alchemy/shared/config";
import type { MysteryChoice, MysteryEvent, MysteryEffect } from "@/lib/mystery";
import { Surface } from "../../../shared/ui/surface";
import { BattleCardButton } from "../../../shared/ui/cards/card-button";
import { MysteryEffectList } from "./mystery-effect-badge";
import { FadeSlot } from "../../../shared/ui/use-fade";
import { PortaledTooltip } from "../../../shared/ui/tooltips/portaled-tooltip";
import { useHoverVisible } from "../../../shared/ui/use-hover-visible";
import { useInteractiveCard } from "../../../shared/ui/use-interactive-card";

const CONFIG = {
  EVENT_IMAGE_WIDTH: 900,
  EVENT_IMAGE_HEIGHT: 675,
};

interface LookupProps {
  previewEffect?: ((effect: MysteryEffect) => MysteryEffect) | undefined;
  findCard: (id: string) => BattleCard | undefined;
  findTrinket: (id: string) => TrinketEntry | undefined;
}

function MysteryEventChoiceButton({
  choice,
  previewEffect,
  findCard,
  findTrinket,
  onPick,
}: {
  choice: MysteryChoice;
  onPick: (choice: MysteryChoice) => void;
} & LookupProps) {
  useGameTranslation();
  const { triggerRef, visible, onMouseEnter, onMouseLeave, onFocusCapture, onBlurCapture } = useHoverVisible();

  return (
    <div
      ref={triggerRef}
      className="relative"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
    >
      <Button
        size="lg"
        variant="outline"
        className="min-w-32"
        data-testid="mystery-choice"
        onClick={() => onPick(choice)}
      >
        {displayText(choice.label)}
      </Button>
      <PortaledTooltip triggerRef={triggerRef} visible={visible} maxWidthFraction={0.4}>
        <MysteryEffectList
          effects={previewEffect ? choice.effects.map(previewEffect) : choice.effects}
          findCard={findCard}
          findTrinket={findTrinket}
          choiceLabel={choice.label}
        />
      </PortaledTooltip>
    </div>
  );
}

export function MysteryEventIntro({
  event,
  previewEffect,
  findCard,
  findTrinket,
  onPick,
}: {
  event: MysteryEvent;
  previewEffect?: ((effect: MysteryEffect) => MysteryEffect) | undefined;
  findCard: (id: string) => BattleCard | undefined;
  findTrinket: (id: string) => TrinketEntry | undefined;
  onPick: (choice: MysteryChoice) => void;
}) {
  useGameTranslation();
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const featuredCard = findCard(event.id);
  const isHovered = hoveredCardId === event.id;
  const { onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard("mystery-event-art", event.id);

  return (
    <div className="flex w-full flex-col items-center gap-6">
      {event.art ? (
        <Surface
          shimmerActive={shimmerActive}
          shimmerToken={shimmerToken}
          onMouseEnter={onHoverStart}
          onMouseLeave={onHoverEnd}
          testId="mystery-event-art-surface"
          className={cn(
            cardSurfaceClass,
            cardInteractiveGlowClass,
            standaloneLandscapeArtWidthClass,
            "aspect-[4/3] border border-border/80 shadow-md",
          )}
        >
          <img
            src={event.art}
            alt={displayText(event.title)}
            width={CONFIG.EVENT_IMAGE_WIDTH}
            height={CONFIG.EVENT_IMAGE_HEIGHT}
            className={cn("h-full w-full", landscapeArtImageClass)}
            loading="eager"
            decoding="async"
            data-testid="mystery-event-art"
          />
        </Surface>
      ) : featuredCard ? (
        <div>
          <BattleCardButton
            card={featuredCard}
            hovered={isHovered}
            onHoverStart={() => setHoveredCardId(event.id)}
            onHoverEnd={() => setHoveredCardId(null)}
            ariaLabel={displayText(featuredCard.title)}
            shimmerActive={false}
            shimmerToken={undefined}
            shineColor={getCardInspectionShineColors(featuredCard)}
            className={viewCardWidthClass}
          />
        </div>
      ) : null}
      <div>
        <TextAnimate once className={cn("max-w-lg text-center", bodyTextClass)}>
          {displayText(event.narrative)}
        </TextAnimate>
      </div>

      <FadeSlot swapKey={event.id} className="flex flex-wrap justify-center gap-4">
        {event.choices.map((choice, i) => (
          <div key={i}>
            <MysteryEventChoiceButton
              choice={choice}
              previewEffect={previewEffect}
              findCard={findCard}
              findTrinket={findTrinket}
              onPick={onPick}
            />
          </div>
        ))}
      </FadeSlot>
    </div>
  );
}
