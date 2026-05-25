import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { BestiaryEntry } from "@/lib/game-data";
import { destinationMeta, staticCardTransform } from "../config";
import { type Destination } from "../types";
import { clearTiltFromEvent, setTiltFromEvent } from "../utils";
import { PressableMotion } from "./pressable-motion";

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
    <div className="flex flex-wrap justify-center gap-8">
      {destinationOptions.map((destination, index) => {
        const { icon: Icon, className, art: defaultArt } = destinationMeta[destination];
        const art = destination === "Boss Combat" && selectedBoss?.art ? selectedBoss.art : defaultArt;
        return (
          <div
            key={destination}
            className="stagger-item flex flex-col items-center gap-4"
            style={{ "--stagger-index": index } as CSSProperties}
          >
            <div
              className="tilt-surface rounded-[18px]"
              style={{ "--card-base-transform": staticCardTransform } as CSSProperties}
              onMouseMove={setTiltFromEvent}
              onMouseLeave={clearTiltFromEvent}
            >
              <img src={art} alt={destination} className="w-full max-w-[32.59cqh] rounded-[18px] object-contain" />
            </div>
            <div className="relative rounded-full">
              <PressableMotion style={{ display: "inline-block" }} disableHoverScale>
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
          </div>
        );
      })}
    </div>
  );
}
