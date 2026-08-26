import type { TrinketEntry } from "@/lib/game-data";
import { getShopItemAriaLabel, getShopPurchaseState } from "./purchasable-shop-helpers";
import { PurchasableShopTile, ShopPriceChip } from "./purchasable-shop-tile";
import { TrinketTile } from "./collection-art-tiles";

interface PurchasableTrinketItemProps {
  trinket: TrinketEntry;
  price: number;
  gold: number;
  purchased: boolean;
  onBuy: () => void;
}

export function PurchasableTrinketItem({ trinket, price, gold, purchased, onBuy }: PurchasableTrinketItemProps) {
  const { canPurchase } = getShopPurchaseState(price, gold, purchased);
  const media = (
    <TrinketTile
      trinket={trinket}
      interactionKey="shop"
      as="button"
      shine={!purchased}
      interactiveChrome={!purchased}
      disabled={!canPurchase}
      onClick={canPurchase ? onBuy : undefined}
      ariaLabel={getShopItemAriaLabel(trinket.title, purchased)}
    >
      <ShopPriceChip price={price} gold={gold} purchased={purchased} />
    </TrinketTile>
  );

  return <PurchasableShopTile media={media} purchased={purchased} />;
}
