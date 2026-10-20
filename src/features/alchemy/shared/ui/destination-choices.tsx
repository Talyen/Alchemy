import { useGameTranslation } from "@/components/use-game-translation";

import { useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { ShineBorder } from "@/components/ui/shine-border";
import type { BestiaryEntry } from "@/lib/game-data";
import type { PlasmaColorPair } from "@/lib/animation/plasma-colors";
import { DESTINATIONS, destinationLabel, type Destination } from "@/lib/routing";
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
import { EnemyTooltip } from "./tooltips/enemy-tooltip";
import { FadeSlot } from "./use-fade";

export function DestinationChoices({
  destinationOptions,
  currentAct,
  onChoose,
  selectedBoss,
}: {
  destinationOptions: Destination[];
  currentAct: number;
  onChoose: (destination: Destination) => void;
  selectedBoss?: BestiaryEntry | null;
}) {
  const i18n = useGameTranslation();
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
            label={i18n.displayText(
              destination === DESTINATIONS.BOSS_COMBAT
                ? i18n.text("ui.destination-choices.d1", "Boss - Act {{act}}", {
                    act: ["I", "II", "III"][currentAct - 1] ?? currentAct,
                  })
                : destinationLabel(destination),
            )}
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
  label,
  art,
  icon,
  accentClassName,
  plasmaColorPair,
  tooltipEntry,
  padded,
  onChoose,
}: {
  destination: Destination;
  label: string;
  art: string;
  icon: LucideIcon;
  accentClassName: string;
  plasmaColorPair: PlasmaColorPair;
  tooltipEntry: BestiaryEntry | null;
  padded: boolean;
  onChoose: (destination: Destination) => void;
}) {
  useGameTranslation();
  const bossTriggerRef = useRef<HTMLButtonElement>(null);

  return (
    <ChooserArtTile
      interactionKey="destination"
      interactionId={destination}
      art={art}
      icon={icon}
      label={label}
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
            className="z-20 rounded-shell-card opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-navigation:group-focus-within:opacity-100"
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
