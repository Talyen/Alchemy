// Shop gear tile with buy button and sold-out state.
import { gearDefinitions, getAstralShineColors, getGearInstanceTitle, type GearInstance } from "@/lib/gear";
import { cn } from "@/lib/utils";
import { cardSurfaceClass, collectionTileWidthClass, gearArtAspectClass, gearArtFillClass } from "../config";
import { GearDetailPopup } from "./gear-detail-popup";
import { InteractiveArtTile } from "./interactive-art-tile";
import { PurchasableShopTile, ShopPriceChip } from "./purchasable-shop-tile";

interface PurchasableGearItemProps {
  instance: GearInstance;
  price: number;
  gold: number;
  purchased: boolean;
  onBuy: () => void;
}

export function PurchasableGearItem({ instance, price, gold, purchased, onBuy }: PurchasableGearItemProps) {
  const definition = gearDefinitions[instance.definitionId];
  const title = getGearInstanceTitle(instance);
  const art = definition?.art ?? "";
  const canAfford = gold >= price;
  const media = (
    <InteractiveArtTile
      id={instance.instanceId}
      interactionKey="shop"
      title={title}
      art={art}
      as="button"
      className={cn(cardSurfaceClass, collectionTileWidthClass, gearArtAspectClass)}
      imageClassName={gearArtFillClass}
      shineColor={purchased ? undefined : getAstralShineColors(instance)}
      interactiveChrome={!purchased}
      disabled={purchased || !canAfford}
      onClick={!purchased && canAfford ? onBuy : undefined}
      ariaLabel={purchased ? title : `Buy ${title}`}
      popup={({ visible, triggerRef }) => (
        <GearDetailPopup definition={definition} instance={instance} visible={visible} triggerRef={triggerRef} />
      )}
    >
      <ShopPriceChip price={price} gold={gold} purchased={purchased} />
    </InteractiveArtTile>
  );

  return <PurchasableShopTile media={media} price={price} gold={gold} purchased={purchased} onBuy={onBuy} />;
}
