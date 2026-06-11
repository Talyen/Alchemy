import { cn } from "@/lib/utils";
import type { BestiaryEntry } from "@/lib/game-data";
import { destinationMeta } from "../config";
import { type Destination } from "../types";
import { PressableMotion } from "./pressable-motion";
import { TiltSurface } from "./tilt-surface";
import { StaggerGroup, StaggerItem } from "./shared-ui";

export function DestinationChoices({
  destinationOptions,
  onChoose,
  selectedBoss,
}: {
  destinationOptions: Destination[];
  onChoose: (destination: Destination) => void;
  selectedBoss?: BestiaryEntry | null;
}) {
  return (
    <StaggerGroup swapKey={destinationOptions.join("-")} className="flex flex-wrap justify-center gap-8">
      {destinationOptions.map((destination, index) => {
        const { icon: Icon, className, art: defaultArt } = destinationMeta[destination];
        const art = destination === "Boss Combat" && selectedBoss?.art ? selectedBoss.art : defaultArt;
        return (
          <StaggerItem key={destination} index={index} className="flex flex-col items-center gap-4">
            <TiltSurface className="rounded-shell-card">
              <img src={art} alt={destination} className="w-full max-w-[32.59cqh] rounded-shell-card object-contain" />
            </TiltSurface>
            <div className="relative rounded-full">
              <PressableMotion className="inline-block" disableHoverScale>
                <button
                  type="button"
                  onClick={() => onChoose(destination)}
                  className={cn(
                    "relative inline-flex min-h-[4.44cqh] items-center justify-start gap-2 rounded-full border border-border/80 px-4 py-2 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    className,
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-display leading-none">{destination}</span>
                </button>
              </PressableMotion>
            </div>
          </StaggerItem>
        );
      })}
    </StaggerGroup>
  );
}
