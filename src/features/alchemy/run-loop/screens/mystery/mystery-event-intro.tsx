// Mystery event narrative, art, and choice buttons with effect tooltips.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextAnimate } from "@/components/ui/text-animate";
import { type BattleCard, type TrinketEntry } from "@/lib/game-data";

import { viewCardWidthClass } from "@/features/alchemy/shared/config";
import type { MysteryChoice, MysteryEvent } from "@/lib/mystery";
import { TiltSurface } from "../../../shared/ui/tilt-surface";
import { BattleCardButton } from "../../../shared/ui/card-button";
import { MysteryEffectList } from "../../../shared/ui/mystery-effect-badge";
import { ScreenHeader, StaggerGroup, StaggerItem } from "../../../shared/ui/shared-ui";
import { TooltipPanel } from "../../../shared/ui/tooltip-panel";

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
        className="pointer-events-none opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
      >
        <MysteryEffectList
          effects={choice.effects}
          findCard={findCard}
          findTrinket={findTrinket}
          choiceLabel={choice.label}
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
    <StaggerGroup className="flex flex-col items-center gap-6">
      <StaggerItem index={0}>
        <ScreenHeader title={event.title} />
      </StaggerItem>
      {event.art ? (
        <StaggerItem index={1}>
          <TiltSurface className="aspect-[4/3] w-full max-w-[32.59cqh] overflow-hidden rounded-shell-card">
            <img
              src={event.art}
              alt={event.title}
              width={CONFIG.EVENT_IMAGE_WIDTH}
              height={CONFIG.EVENT_IMAGE_HEIGHT}
              className="h-full w-full rounded-shell-card object-contain"
              loading="eager"
            />
          </TiltSurface>
        </StaggerItem>
      ) : featuredCard ? (
        <StaggerItem index={1}>
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
        </StaggerItem>
      ) : null}
      <StaggerItem index={event.art || featuredCard ? 2 : 1}>
        <TextAnimate once className="max-w-lg text-base leading-relaxed text-muted-foreground">
          {event.narrative}
        </TextAnimate>
      </StaggerItem>

      <StaggerGroup swapKey={event.id} animate={false} className="flex flex-wrap justify-center gap-4">
        {event.choices.map((choice, i) => (
          <StaggerItem key={i} index={(event.art || featuredCard ? 3 : 2) + i}>
            <MysteryEventChoiceButton choice={choice} findCard={findCard} findTrinket={findTrinket} onPick={onPick} />
          </StaggerItem>
        ))}
      </StaggerGroup>
    </StaggerGroup>
  );
}
