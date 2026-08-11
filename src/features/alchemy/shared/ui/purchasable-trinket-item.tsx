// Shop trinket tile with buy button and sold-out state.
import type { TrinketEntry } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { cardSurfaceClass, collectionTileWidthClass } from "../config";
import { DetailPopup } from "./card-popup";
import { InteractiveArtTile } from "./interactive-art-tile";
import { PurchasableShopTile } from "./purchasable-shop-tile";

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
  const media = (
    <InteractiveArtTile
      id={trinket.id}
      interactionKey="shop"
      title={trinket.title}
      art={trinket.art}
      className={cn(cardSurfaceClass, collectionTileWidthClass, "aspect-square")}
      imageClassName="absolute inset-0 h-full w-full rounded-shell-hero object-cover"
      interactive={!purchased}
      popup={({ visible, triggerRef }) => (
        <DetailPopup
          idPrefix={trinket.id}
          title={trinket.title}
          subtitle={undefined}
          descriptionLines={trinket.descriptionLines}
          visible={visible}
          triggerRef={triggerRef}
        />
      )}
    />
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
