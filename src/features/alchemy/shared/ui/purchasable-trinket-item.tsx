// Shop trinket tile with buy button and sold-out state.
import type { TrinketEntry } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { cardSurfaceClass, collectionTileWidthClass } from "../config";
import { DetailPopup } from "./card-popup";
import { PurchasableShopTile } from "./purchasable-shop-tile";
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

  const media = purchased ? (
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
        className="absolute inset-0 h-full w-full rounded-shell-hero object-cover"
      />
    </TiltSurface>
  ) : (
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
          className="absolute inset-0 h-full w-full rounded-shell-hero object-cover"
        />
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
