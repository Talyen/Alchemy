import { cn } from "@/lib/utils";
import { gearSlotBackgroundArt } from "@/lib/game-data";
import type { GearDefinition, GearSlot } from "@/lib/gear";
import { gearArtFillClass } from "../../../../shared/config";

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
    <div className="relative h-full w-full">
      <img
        src={gearSlotBackgroundArt[slot]}
        alt=""
        data-testid="armory-slot-background"
        className={cn(gearArtFillClass, "rounded-none brightness-[0.65]")}
      />
      {definition?.art ? (
        <img
          src={definition.art}
          alt=""
          className={cn(gearArtFillClass, "z-10 rounded-none", isHidden && "opacity-0")}
        />
      ) : null}
    </div>
  );
}
