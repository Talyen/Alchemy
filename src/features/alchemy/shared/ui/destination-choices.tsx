import { useRef, useState } from "react";

import type { LucideIcon } from "lucide-react";
import { ShineBorder } from "@/components/ui/shine-border";
import type { BestiaryEntry } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import {
  battleEnemyCardWidthClass,
  cardInteractiveGlowClass,
  chooserArtWidthClass,
  chooserPaddedTileClass,
  chooserRowGapClass,
  destinationMeta,
  getBossEnemy,
  getBossShineColors,
} from "../config";
import { DESTINATIONS, type Destination } from "../types";
import { EnemyTooltip } from "./enemy-tooltip";
import { FadeSlot } from "./fade-slot";
import { TiltSurface } from "./tilt-surface";
import { useInteractiveCard } from "./use-interactive-card";

export function DestinationChoices({
  destinationOptions,
  onChoose,
  selectedBoss,
}: {
  destinationOptions: Destination[];
  onChoose: (destination: Destination) => void;
  selectedBoss?: BestiaryEntry | null;
}) {
  const bossOnly = destinationOptions.length === 1 && destinationOptions[0] === DESTINATIONS.BOSS_COMBAT;
  const tooltipEntry = bossOnly ? (selectedBoss ?? getBossEnemy()) : null;

  return (
    <FadeSlot
      swapKey={destinationOptions.join("-")}
      className={cn(
        "flex justify-center",
        bossOnly ? "flex-wrap gap-8" : ["w-full flex-nowrap items-start", chooserRowGapClass],
      )}
    >
      {destinationOptions.map((destination) => {
        const { icon, accentClassName, art: defaultArt } = destinationMeta[destination];
        const art = destination === DESTINATIONS.BOSS_COMBAT && selectedBoss?.art ? selectedBoss.art : defaultArt;

        return (
          <DestinationChoiceTile
            key={destination}
            destination={destination}
            art={art}
            icon={icon}
            accentClassName={accentClassName}
            tooltipEntry={tooltipEntry}
            padded={!bossOnly}
            onChoose={onChoose}
          />
        );
      })}
    </FadeSlot>
  );
}

function DestinationChoiceTile({
  destination,
  art,
  icon: Icon,
  accentClassName,
  tooltipEntry,
  padded,
  onChoose,
}: {
  destination: Destination;
  art: string;
  icon: LucideIcon;
  accentClassName: string;
  tooltipEntry: BestiaryEntry | null;
  padded: boolean;
  onChoose: (destination: Destination) => void;
}) {
  const { onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard("destination", destination);

  return (
    <div className={cn("group flex flex-col items-center gap-5", padded && chooserPaddedTileClass)}>
      {tooltipEntry ? (
        <BossDestinationArt
          art={art}
          destination={destination}
          entry={tooltipEntry}
          shimmerActive={shimmerActive}
          shimmerToken={shimmerToken}
          onChoose={onChoose}
          onHoverStart={onHoverStart}
          onHoverEnd={onHoverEnd}
        />
      ) : (
        <TiltSurface
          as="button"
          ariaLabel={destination}
          onClick={() => {
            onChoose(destination);
          }}
          onMouseEnter={onHoverStart}
          onMouseLeave={onHoverEnd}
          onFocus={onHoverStart}
          onBlur={onHoverEnd}
          shimmerActive={shimmerActive}
          shimmerToken={shimmerToken}
          shimmerRounded="rounded-shell-card"
          className={cn(
            "group relative mx-auto block aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-shell-card border border-border/80 bg-black shadow-md focus:outline-none",
            chooserArtWidthClass,
            cardInteractiveGlowClass,
          )}
        >
          <img
            src={art}
            alt=""
            aria-hidden
            className="pointer-events-none h-full w-full object-cover select-none"
            draggable={false}
          />
        </TiltSurface>
      )}
      <div className="pointer-events-none flex items-center justify-center gap-2.5 pt-1 text-center select-none">
        <Icon className={cn("h-5 w-5 shrink-0", accentClassName)} />
        <span className={cn("font-sans text-lg font-bold tracking-wide sm:text-xl", accentClassName)}>
          {destination}
        </span>
      </div>
    </div>
  );
}

function BossDestinationArt({
  art,
  destination,
  entry,
  shimmerActive,
  shimmerToken,
  onChoose,
  onHoverStart,
  onHoverEnd,
}: {
  art: string;
  destination: Destination;
  entry: BestiaryEntry;
  shimmerActive: boolean;
  shimmerToken: number | undefined;
  onChoose: (destination: Destination) => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}) {
  const artWrapperRef = useRef<HTMLButtonElement>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  return (
    <div className="relative">
      <EnemyTooltip entry={entry} triggerRef={artWrapperRef} visible={tooltipVisible} />
      <TiltSurface
        as="button"
        buttonRef={artWrapperRef}
        ariaLabel={destination}
        onMouseEnter={() => {
          setTooltipVisible(true);
          onHoverStart();
        }}
        onMouseLeave={() => {
          setTooltipVisible(false);
          onHoverEnd();
        }}
        onFocus={() => {
          setTooltipVisible(true);
          onHoverStart();
        }}
        onBlur={() => {
          setTooltipVisible(false);
          onHoverEnd();
        }}
        onClick={() => {
          onChoose(destination);
        }}
        shimmerActive={shimmerActive}
        shimmerToken={shimmerToken}
        shimmerRounded="rounded-shell-card"
        overlay={
          <ShineBorder
            shineColor={getBossShineColors(entry)}
            borderWidth={3}
            duration={10}
            className="z-20 rounded-shell-card"
          />
        }
        className={cn(
          "group relative mx-auto block aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-shell-card border border-border/80 bg-black shadow-md focus:outline-none",
          battleEnemyCardWidthClass,
          cardInteractiveGlowClass,
        )}
      >
        <img
          src={art}
          alt=""
          aria-hidden
          className="pointer-events-none block h-full w-full object-cover select-none"
          draggable={false}
        />
      </TiltSurface>
    </div>
  );
}
