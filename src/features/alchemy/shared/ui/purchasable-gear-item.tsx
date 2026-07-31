// Shop gear tile with buy button and sold-out state.
import { gearDefinitions, getGearInstanceTitle, type GearInstance } from "@/lib/gear";
import { cn } from "@/lib/utils";
import { cardSurfaceClass, collectionTileWidthClass } from "../config";
import { GearDetailPopup } from "./gear-detail-popup";
import { gearInstanceAspectClass } from "./gear-aspect";
import { InteractiveArtTile } from "./interactive-art-tile";
import { PurchasableShopTile } from "./purchasable-shop-tile";

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
  const media = (
    <InteractiveArtTile
      id={instance.instanceId}
      interactionKey="shop"
      title={title}
      art={art}
      className={cn(cardSurfaceClass, collectionTileWidthClass, gearInstanceAspectClass(definition))}
      imageClassName="absolute inset-0 h-full w-full rounded-shell-hero object-cover"
      interactive={!purchased}
      popup={<GearDetailPopup definition={definition} instance={instance} />}
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
