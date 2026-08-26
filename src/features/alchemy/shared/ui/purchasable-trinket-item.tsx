// Shop trinket tile with buy button and sold-out state.
import type { TrinketEntry } from "@/lib/game-data";
import { ShopPriceChip, PurchasableShopTile } from "./purchasable-shop-tile";
import { TrinketTile } from "./collection-art-tiles";

interface PurchasableTrinketItemProps {
  trinket: TrinketEntry;
  price: number;
  gold: number;
  purchased: boolean;
  onBuy: () => void;
}

export function PurchasableTrinketItem({ trinket, price, gold, purchased, onBuy }: PurchasableTrinketItemProps) {
  const canAfford = gold >= price;
  const canPurchase = !purchased && canAfford;
  const media = (
    <TrinketTile
      trinket={trinket}
      interactionKey="shop"
      as="button"
      shine={!purchased}
      interactiveChrome={!purchased}
      disabled={!canPurchase}
      onClick={canPurchase ? onBuy : undefined}
      ariaLabel={purchased ? trinket.title : `Buy ${trinket.title}`}
    >
      <ShopPriceChip price={price} gold={gold} purchased={purchased} />
    </TrinketTile>
  );

  return <PurchasableShopTile media={media} purchased={purchased} />;
}
