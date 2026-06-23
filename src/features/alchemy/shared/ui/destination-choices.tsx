import { useMemo } from "react";

import type { BestiaryEntry } from "@/lib/game-data";
import { destinationMeta, getBossEnemy, getBossShineColors, SHINE_PALETTES } from "../config";
import { type Destination } from "../types";
import { ChoiceButton } from "./choice-button";
import { TiltSurface } from "./tilt-surface";
import { StaggerGroup } from "./stagger-group";
import { StaggerItem } from "./stagger-item";

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
  const bossCombatShineBoss = useMemo(
    () => (destinationOptions.includes("Boss Combat") ? (selectedBoss ?? getBossEnemy()) : null),
    [destinationOptions, selectedBoss],
  );

  return (
    <StaggerGroup swapKey={destinationOptions.join("-")} className="flex flex-wrap justify-center gap-8">
      {destinationOptions.map((destination, index) => {
        const { icon, accentClassName, art: defaultArt } = destinationMeta[destination];
        const art = destination === "Boss Combat" && selectedBoss?.art ? selectedBoss.art : defaultArt;
        const shineColors =
          destination === "Boss Combat" && bossCombatShineBoss
            ? getBossShineColors(bossCombatShineBoss)
            : destination === "Corruption"
              ? SHINE_PALETTES.corruption
              : null;
        const useShineBorder = SHINE_BORDER_DESTINATIONS.has(destination) && shineColors !== null;

        return (
          <StaggerItem key={destination} index={index} className="flex flex-col items-center gap-4">
            <TiltSurface className="rounded-shell-card">
              <img src={art} alt={destination} className="w-full max-w-[32.59cqh] rounded-shell-card object-contain" />
            </TiltSurface>
            <ChoiceButton
              label={destination}
              icon={icon}
              accentClassName={accentClassName}
              shineColor={useShineBorder ? shineColors : null}
              onClick={() => onChoose(destination)}
            />
          </StaggerItem>
        );
      })}
    </StaggerGroup>
  );
}
