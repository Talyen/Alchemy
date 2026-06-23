// Shop trinket tile with buy button and sold-out state.
import { Button } from "@/components/ui/button";
import type { TrinketEntry } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { cardSurfaceClass, collectionTileWidthClass } from "../config";
import { DetailPopup } from "./card-popup";
import { DisabledTooltip, GoldCost, StaggerItem } from "./shared-ui";
import { TiltSurface } from "./tilt-surface";
import { useInteractiveCard } from "./use-interactive-card";

interface PurchasableTrinketItemProps {
  trinket: TrinketEntry;
  price: number;
  gold: number;
  purchased: boolean;
  onBuy: () => void;
  staggerIndex?: number;
}

export function PurchasableTrinketItem({
  trinket,
  price,
  gold,
  purchased,
  onBuy,
  staggerIndex,
}: PurchasableTrinketItemProps) {
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard("shop", trinket.id);

  if (purchased) {
    const content = (
      <div className="flex flex-col items-center gap-3 rounded-shell-card border border-border/30 bg-card/30 p-4 text-center opacity-50">
        <TiltSurface
          as="div"
          className={cn(cardSurfaceClass, collectionTileWidthClass, "group", "aspect-square")}
          shimmerActive={false}
          shimmerToken={undefined}
          selected={false}
          ariaLabel={trinket.title}
        >
          <img
            src={trinket.art || undefined}
            alt={trinket.title}
            className="absolute inset-0 h-full w-full object-cover rounded-shell-hero"
          />
        </TiltSurface>
        <span className="text-xs font-semibold text-muted-foreground">Purchased</span>
      </div>
    );
    return staggerIndex !== undefined ? <StaggerItem index={staggerIndex}>{content}</StaggerItem> : content;
  }

  const content = (
    <div className="flex flex-col items-center gap-3 rounded-shell-card border border-border/70 bg-card/60 p-4 text-center">
      <div onMouseEnter={onHoverStart} onMouseLeave={onHoverEnd}>
        {isHovered ? (
          <DetailPopup
            idPrefix={trinket.id}
            title={trinket.title}
            subtitle={undefined}
            descriptionLines={trinket.descriptionLines}
          />
        ) : null}
        <TiltSurface
          as="div"
          className={cn(cardSurfaceClass, collectionTileWidthClass, "group", "aspect-square")}
          shimmerActive={shimmerActive}
          shimmerToken={shimmerToken}
          selected={false}
          ariaLabel={trinket.title}
        >
          <img
            src={trinket.art || undefined}
            alt={trinket.title}
            className="absolute inset-0 h-full w-full object-cover rounded-shell-hero"
          />
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
