import { cn } from "@/lib/utils";
import { gearSlotBackgroundArt } from "@/lib/game-data";
import type { GearDefinition, GearSlot } from "@/lib/gear";

export function GearSlotArt({
  definition,
  slot,
  isHidden = false,
}: {
  definition: GearDefinition | undefined;
  slot: GearSlot;
  isHidden?: boolean;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl">
      <img
        src={gearSlotBackgroundArt[slot]}
        alt=""
        data-testid="armory-slot-background"
        className="absolute inset-0 h-full w-full object-cover brightness-[0.65]"
      />
      {definition?.art ? (
        <img
          src={definition.art}
          alt=""
          className={cn(
            "absolute -inset-px z-10 h-[calc(100%+2px)] w-[calc(100%+2px)] max-w-none object-cover image-rendering-pixelated",
            isHidden && "opacity-0",
          )}
        />
      ) : null}
    </div>
  );
}
