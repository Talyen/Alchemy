import { useMemo, useRef, useState } from "react";

import type { LucideIcon } from "lucide-react";
import type { BestiaryEntry } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import {
  battleEnemyCardWidthClass,
  chooserArtWidthClass,
  chooserPaddedTileClass,
  chooserRowGapClass,
  destinationMeta,
  getBossEnemy,
  getBossShineColors,
  landscapeArtImageClass,
  SHINE_PALETTES,
} from "../config";
import { DESTINATIONS, type Destination } from "../types";
import { ChoiceButton } from "./choice-button";
import { EnemyTooltip } from "./enemy-tooltip";
import { FadeSlot } from "./fade-slot";
import { TiltSurface } from "./tilt-surface";

const SHINE_BORDER_DESTINATIONS = new Set<Destination>(["Boss Combat", "Corruption"]);

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
  const bossCombatShineBoss = useMemo(
    () => (destinationOptions.includes("Boss Combat") ? (selectedBoss ?? getBossEnemy()) : null),
    [destinationOptions, selectedBoss],
  );
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
        const shineColors =
          destination === DESTINATIONS.BOSS_COMBAT && bossCombatShineBoss
            ? getBossShineColors(bossCombatShineBoss)
            : destination === "Corruption"
              ? SHINE_PALETTES.corruption
              : null;
        const useShineBorder = SHINE_BORDER_DESTINATIONS.has(destination) && shineColors !== null;

        return (
          <DestinationChoiceTile
            key={destination}
            destination={destination}
            art={art}
            icon={icon}
            accentClassName={accentClassName}
            shineColors={useShineBorder ? shineColors : null}
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
  icon,
  accentClassName,
  shineColors,
  tooltipEntry,
  padded,
  onChoose,
}: {
  destination: Destination;
  art: string;
  icon: LucideIcon;
  accentClassName: string;
  shineColors: string | readonly string[] | null;
  tooltipEntry: BestiaryEntry | null;
  padded: boolean;
  onChoose: (destination: Destination) => void;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-4", padded && chooserPaddedTileClass)}>
      {tooltipEntry ? (
        <BossDestinationArt art={art} destination={destination} entry={tooltipEntry} />
      ) : (
        <TiltSurface className="w-full min-w-0 rounded-shell-card">
          <img
            src={art}
            alt={destination}
            className={cn(chooserArtWidthClass, "min-w-0 rounded-shell-card object-contain")}
          />
        </TiltSurface>
      )}
      <ChoiceButton
        label={destination}
        icon={icon}
        accentClassName={accentClassName}
        shineColor={shineColors}
        onClick={() => onChoose(destination)}
      />
    </div>
  );
}

function BossDestinationArt({
  art,
  destination,
  entry,
}: {
  art: string;
  destination: Destination;
  entry: BestiaryEntry;
}) {
  const artWrapperRef = useRef<HTMLDivElement>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  return (
    <div
      ref={artWrapperRef}
      className="group/art-wrapper relative"
      tabIndex={0}
      onMouseEnter={() => setTooltipVisible(true)}
      onMouseLeave={() => setTooltipVisible(false)}
      onFocus={() => setTooltipVisible(true)}
      onBlur={() => setTooltipVisible(false)}
    >
      <EnemyTooltip entry={entry} triggerRef={artWrapperRef} visible={tooltipVisible} />
      <TiltSurface className={cn("rounded-shell-card", battleEnemyCardWidthClass)}>
        <img src={art} alt={destination} className={cn("block w-full", landscapeArtImageClass)} />
      </TiltSurface>
    </div>
  );
}
