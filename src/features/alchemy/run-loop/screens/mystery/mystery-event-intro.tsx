// Mystery event narrative, art, and choice buttons with effect tooltips.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextAnimate } from "@/components/ui/text-animate";
import { type BattleCard, type TrinketEntry } from "@/lib/game-data";

import { viewCardWidthClass } from "@/features/alchemy/config";
import type { MysteryChoice, MysteryEvent } from "../../mystery-events";
import { TiltSurface } from "../../../shared/ui/tilt-surface";
import { BattleCardButton } from "../../../shared/ui/card-button";
import { MysteryEffectList } from "../../../shared/ui/mystery-effect-badge";
import { ScreenHeader } from "../../../shared/ui/shared-ui";
import { TooltipPanel } from "../../../shared/ui/tooltip-panel";

const CONFIG = {
  EVENT_IMAGE_WIDTH: 900,
  EVENT_IMAGE_HEIGHT: 675,
};

type LookupProps = {
  findCard: (id: string) => BattleCard | undefined;
  findTrinket: (id: string) => TrinketEntry | undefined;
};

function MysteryEventChoiceButton({
  choice,
  findCard,
  findTrinket,
  onPick,
}: {
  choice: MysteryChoice;
  onPick: (choice: MysteryChoice) => void;
} & LookupProps) {
  return (
    <div className="group relative">
      <Button
        size="lg"
        variant="outline"
        className="min-w-32"
        data-testid="mystery-choice"
        onClick={() => onPick(choice)}
      >
        {choice.label}
      </Button>
      <TooltipPanel
        width="w-[23.7cqh]"
        className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <MysteryEffectList
          effects={choice.effects}
          findCard={findCard}
          findTrinket={findTrinket}
          choiceLabel={choice.label}
          choiceDescription={choice.description}
        />
      </TooltipPanel>
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

  return (
    <div className="state-swap flex flex-col items-center gap-6">
      <ScreenHeader title={event.title} />
      {event.art ? (
        <TiltSurface className="aspect-[4/3] w-full max-w-[32.59cqh] overflow-hidden rounded-shell-card transition-none">
          <img
            src={event.art}
            alt={event.title}
            width={CONFIG.EVENT_IMAGE_WIDTH}
            height={CONFIG.EVENT_IMAGE_HEIGHT}
            className="h-full w-full rounded-shell-card object-contain"
            loading="eager"
          />
        </TiltSurface>
      ) : featuredCard ? (
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
      ) : null}
      <TextAnimate once className="max-w-lg text-base leading-relaxed text-muted-foreground">
        {event.narrative}
      </TextAnimate>

      <div className="flex flex-wrap justify-center gap-4">
        {event.choices.map((choice, i) => (
          <MysteryEventChoiceButton
            key={i}
            choice={choice}
            findCard={findCard}
            findTrinket={findTrinket}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  );
}
