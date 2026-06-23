// Shop gear tile with buy button and sold-out state.
import { Button } from "@/components/ui/button";
import { gearDefinitions, getGearInstanceTitle, type GearInstance } from "@/lib/gear";
import { cn } from "@/lib/utils";

import { cardSurfaceClass, collectionTileWidthClass } from "../config";
import { DisabledTooltip, GoldCost, StaggerItem } from "./shared-ui";
import { GearDetailPopup } from "./gear-detail-popup";
import { gearInstanceAspectClass } from "./gear-aspect";
import { TiltSurface } from "./tilt-surface";
import { useInteractiveCard } from "./use-interactive-card";

interface PurchasableGearItemProps {
  instance: GearInstance;
  price: number;
  gold: number;
  purchased: boolean;
  onBuy: () => void;
  staggerIndex?: number;
}

export function PurchasableGearItem({
  instance,
  price,
  gold,
  purchased,
  onBuy,
  staggerIndex,
}: PurchasableGearItemProps) {
  const definition = gearDefinitions[instance.definitionId];
  const title = getGearInstanceTitle(instance);
  const art = definition?.art ?? "";
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard(
    "shop",
    instance.instanceId,
  );

  if (purchased) {
    const content = (
      <div className="flex flex-col items-center gap-3 rounded-shell-card border border-border/30 bg-card/30 p-4 text-center opacity-50">
        <TiltSurface
          as="div"
          className={cn(cardSurfaceClass, collectionTileWidthClass, "group", gearInstanceAspectClass(definition))}
          shimmerActive={false}
          shimmerToken={undefined}
          selected={false}
          ariaLabel={title}
        >
          <img src={art} alt={title} className="absolute inset-0 h-full w-full object-cover rounded-shell-hero" />
        </TiltSurface>
        <span className="text-xs font-semibold text-muted-foreground">Purchased</span>
      </div>
    );
    return staggerIndex !== undefined ? <StaggerItem index={staggerIndex}>{content}</StaggerItem> : content;
  }

  const content = (
    <div className="flex flex-col items-center gap-3 rounded-shell-card border border-border/70 bg-card/60 p-4 text-center">
      <div onMouseEnter={onHoverStart} onMouseLeave={onHoverEnd}>
        {isHovered ? <GearDetailPopup definition={definition} instance={instance} /> : null}
        <TiltSurface
          as="div"
          className={cn(cardSurfaceClass, collectionTileWidthClass, "group", gearInstanceAspectClass(definition))}
          shimmerActive={shimmerActive}
          shimmerToken={shimmerToken}
          selected={false}
          ariaLabel={title}
        >
          <img src={art} alt={title} className="absolute inset-0 h-full w-full object-cover rounded-shell-hero" />
        </TiltSurface>
      </div>
      <DisabledTooltip show={gold < price} message="Not Enough Gold">
        <Button variant="outline" disabled={gold < price} onClick={onBuy}>
          Buy <GoldCost amount={price} />
        </Button>
      </DisabledTooltip>
    </div>
  );

  return staggerIndex !== undefined ? <StaggerItem index={staggerIndex}>{content}</StaggerItem> : content;
}
