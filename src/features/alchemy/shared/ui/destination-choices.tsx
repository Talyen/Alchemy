import { useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { ShineBorder } from "@/components/ui/shine-border";
import type { BestiaryEntry } from "@/lib/game-data";
import type { PlasmaColorPair } from "@/lib/animation/plasma-colors";
import { DESTINATIONS, type Destination } from "@/lib/routing";
import { cn } from "@/lib/utils";
import {
  battleEnemyCardWidthClass,
  chooserArtWidthClass,
  chooserPaddedTileClass,
  chooserRowGapClass,
  destinationMeta,
  getBossEnemy,
  getBossShineColors,
} from "../config";
import { ChooserArtTile } from "./chooser-art-tile";
import { EnemyTooltip } from "./enemy-tooltip";
import { FadeSlot } from "./fade-slot";

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
        const { icon, accentClassName, art: defaultArt, plasmaColorPair } = destinationMeta[destination];
        const art = destination === DESTINATIONS.BOSS_COMBAT && selectedBoss?.art ? selectedBoss.art : defaultArt;

        return (
          <DestinationChoiceTile
            key={destination}
            destination={destination}
            art={art}
            icon={icon}
            accentClassName={accentClassName}
            plasmaColorPair={plasmaColorPair}
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
  plasmaColorPair,
  tooltipEntry,
  padded,
  onChoose,
}: {
  destination: Destination;
  art: string;
  icon: LucideIcon;
  accentClassName: string;
  plasmaColorPair: PlasmaColorPair;
  tooltipEntry: BestiaryEntry | null;
  padded: boolean;
  onChoose: (destination: Destination) => void;
}) {
  const bossTriggerRef = useRef<HTMLButtonElement>(null);

  return (
    <ChooserArtTile
      interactionKey="destination"
      interactionId={destination}
      art={art}
      icon={icon}
      label={destination}
      accentClassName={accentClassName}
      plasmaColorPair={plasmaColorPair}
      widthClass={tooltipEntry ? battleEnemyCardWidthClass : chooserArtWidthClass}
      paddedTileClass={padded ? chooserPaddedTileClass : undefined}
      overlay={
        tooltipEntry ? (
          <ShineBorder
            shineColor={getBossShineColors(tooltipEntry)}
            borderWidth={3}
            duration={10}
            className="z-20 rounded-shell-card"
          />
        ) : undefined
      }
      onClick={() => {
        onChoose(destination);
      }}
      tooltipTriggerRef={bossTriggerRef}
      renderTooltip={
        tooltipEntry
          ? (visible) => <EnemyTooltip entry={tooltipEntry} triggerRef={bossTriggerRef} visible={visible} />
          : undefined
      }
    />
  );
}
