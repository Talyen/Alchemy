// Shop gear tile with buy button and sold-out state.
import { gearDefinitions, getGearInstanceTitle, type GearInstance } from "@/lib/gear";
import { cn } from "@/lib/utils";

import { cardSurfaceClass, collectionTileWidthClass } from "../config";
import { GearDetailPopup } from "./gear-detail-popup";
import { gearInstanceAspectClass } from "./gear-aspect";
import { PurchasableShopTile } from "./purchasable-shop-tile";
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

  const media = purchased ? (
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
  ) : (
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
  );

  return (
    <PurchasableShopTile
      media={media}
      price={price}
      gold={gold}
      purchased={purchased}
      onBuy={onBuy}
      {...(staggerIndex !== undefined ? { staggerIndex } : {})}
    />
  );
}
