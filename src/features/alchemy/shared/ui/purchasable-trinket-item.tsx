// Shop trinket tile with buy button and sold-out state.
import type { TrinketEntry } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { trinketArtFillClass, trinketArtImageClass, trinketArtTileClass } from "../config";
import { DetailPopup } from "./card-popup";
import { InteractiveArtTile } from "./interactive-art-tile";
import { PurchasableShopTile, ShopPriceChip } from "./purchasable-shop-tile";

interface PurchasableTrinketItemProps {
  trinket: TrinketEntry;
  price: number;
  gold: number;
  purchased: boolean;
  onBuy: () => void;
}

export function PurchasableTrinketItem({ trinket, price, gold, purchased, onBuy }: PurchasableTrinketItemProps) {
  const canAfford = gold >= price;
  const media = (
    <InteractiveArtTile
      id={trinket.id}
      interactionKey="shop"
      title={trinket.title}
      art={trinket.art}
      as="button"
      className={trinketArtTileClass}
      imageClassName={cn(trinketArtFillClass, trinketArtImageClass)}
      interactiveChrome={!purchased}
      disabled={purchased || !canAfford}
      onClick={!purchased && canAfford ? onBuy : undefined}
      ariaLabel={purchased ? trinket.title : `Buy ${trinket.title}`}
      popup={({ visible, triggerRef }) => (
        <DetailPopup
          idPrefix={trinket.id}
          title={trinket.title}
          footerChip="This Run"
          descriptionLines={trinket.descriptionLines}
          visible={visible}
          triggerRef={triggerRef}
        />
      )}
    >
      <ShopPriceChip price={price} gold={gold} purchased={purchased} />
    </InteractiveArtTile>
  );

  return <PurchasableShopTile media={media} price={price} gold={gold} purchased={purchased} onBuy={onBuy} />;
}
