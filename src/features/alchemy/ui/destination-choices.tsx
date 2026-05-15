import type { CSSProperties, MutableRefObject } from "react";
import { cn } from "@/lib/utils";
import { ShineBorder } from "@/components/ui/shine-border";
import { destinationMeta, staticCardTransform } from "../config";
import { DESTINATIONS, type Destination } from "../types";
import { clearTiltFromEvent, setTiltFromEvent } from "../utils";

export function DestinationChoices({
  destinationOptions,
  onChoose,
  buttonRefs,
}: {
  destinationOptions: Destination[];
  onChoose: (destination: Destination) => void;
  buttonRefs: MutableRefObject<Partial<Record<Destination, HTMLButtonElement | null>>>;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-8">
      {destinationOptions.map((destination, index) => {
        const { icon: Icon, className, art } = destinationMeta[destination];
        const isCorruption = destination === DESTINATIONS.CORRUPTION;
        return (
          <div key={destination} className="stagger-item flex flex-col items-center gap-4" style={{ "--stagger-index": index } as CSSProperties}>
            <div
              className="tilt-surface rounded-[18px]"
              style={{ "--card-base-transform": staticCardTransform } as CSSProperties}
              onMouseMove={setTiltFromEvent}
              onMouseLeave={clearTiltFromEvent}
            >
              <img src={art} alt={destination} className="w-full max-w-[352px] rounded-[18px] object-contain" />
            </div>
            <div className="relative rounded-full">
              {isCorruption && (
                <ShineBorder
                  shineColor={["#450a0a", "#ef4444", "#991b1b", "#7f1d1d"]}
                  borderWidth={2}
                  duration={8}
                  className="z-10 rounded-full"
                />
              )}
              <button
                ref={(node) => { buttonRefs.current[destination] = node; }}
                type="button"
                onClick={() => onChoose(destination)}
                className={cn("relative inline-flex min-h-[48px] items-center justify-start gap-2 rounded-full border border-border/80 px-4 py-2 text-left text-sm font-semibold transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background", className)}
              >
                <span className="rounded-full bg-black/16 p-1.5"><Icon className="h-4 w-4" /></span>
                <span className="leading-none">{destination}</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
