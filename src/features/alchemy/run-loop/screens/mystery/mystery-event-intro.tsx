// Mystery event narrative, art, and choice buttons with effect tooltips.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextAnimate } from "@/components/ui/text-animate";
import { type BattleCard, type TrinketEntry } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import {
  bodyTextClass,
  cardInteractiveGlowClass,
  cardSurfaceClass,
  landscapeArtImageClass,
  standaloneLandscapeArtWidthClass,
  viewCardWidthClass,
} from "@/features/alchemy/shared/config";
import type { MysteryChoice, MysteryEvent } from "@/lib/mystery";
import { TiltSurface } from "../../../shared/ui/tilt-surface";
import { BattleCardButton } from "../../../shared/ui/card-button";
import { MysteryEffectList } from "../../../shared/ui/mystery-effect-badge";
import { FadeSlot } from "../../../shared/ui/fade-slot";
import { PortaledTooltip } from "../../../shared/ui/portaled-tooltip";
import { useHoverVisible } from "../../../shared/ui/use-hover-visible";
import { useInteractiveCard } from "../../../shared/ui/use-interactive-card";

const CONFIG = {
  EVENT_IMAGE_WIDTH: 900,
  EVENT_IMAGE_HEIGHT: 675,
};

interface LookupProps {
  findCard: (id: string) => BattleCard | undefined;
  findTrinket: (id: string) => TrinketEntry | undefined;
}

function MysteryEventChoiceButton({
  choice,
  findCard,
  findTrinket,
  onPick,
}: {
  choice: MysteryChoice;
  onPick: (choice: MysteryChoice) => void;
} & LookupProps) {
  const { triggerRef, visible, onMouseEnter, onMouseLeave, onFocusCapture, onBlurCapture } =
    useHoverVisible<HTMLDivElement>();

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
        {choice.label}
      </Button>
      <PortaledTooltip triggerRef={triggerRef} visible={visible} maxWidthFraction={0.4}>
        <MysteryEffectList
          effects={choice.effects}
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
  findCard,
  findTrinket,
  onPick,
}: {
  event: MysteryEvent;
  findCard: (id: string) => BattleCard | undefined;
  findTrinket: (id: string) => TrinketEntry | undefined;
  onPick: (choice: MysteryChoice) => void;
}) {
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const featuredCard = findCard(event.id);
  const isHovered = hoveredCardId === event.id;
  const { onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard("mystery-event-art", event.id);

  return (
    <div className="flex w-full flex-col items-center gap-6">
      {event.art ? (
        <TiltSurface
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
            alt={event.title}
            width={CONFIG.EVENT_IMAGE_WIDTH}
            height={CONFIG.EVENT_IMAGE_HEIGHT}
            className={cn("h-full w-full", landscapeArtImageClass)}
            loading="eager"
            data-testid="mystery-event-art"
          />
        </TiltSurface>
      ) : featuredCard ? (
        <div>
          <BattleCardButton
            card={featuredCard}
            hovered={isHovered}
            onHoverStart={() => setHoveredCardId(event.id)}
            onHoverEnd={() => setHoveredCardId(null)}
            ariaLabel={featuredCard.title}
            shimmerActive={false}
            shimmerToken={undefined}
            className={viewCardWidthClass}
          />
        </div>
      ) : null}
      <div>
        <TextAnimate once className={cn("max-w-lg text-center", bodyTextClass)}>
          {event.narrative}
        </TextAnimate>
      </div>

      <FadeSlot swapKey={event.id} className="flex flex-wrap justify-center gap-4">
        {event.choices.map((choice, i) => (
          <div key={i}>
            <MysteryEventChoiceButton choice={choice} findCard={findCard} findTrinket={findTrinket} onPick={onPick} />
          </div>
        ))}
      </FadeSlot>
    </div>
  );
}
