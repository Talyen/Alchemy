import type { GearInstance } from "@/lib/gear";
import { getGearInstanceTitle } from "@/lib/gear";
import { getShopItemAriaLabel, getShopPurchaseState } from "./purchasable-shop-helpers";
import { PurchasableShopTile, ShopPriceChip } from "./purchasable-shop-tile";
import { GearTile } from "./collection-art-tiles";

interface PurchasableGearItemProps {
  instance: GearInstance;
  price: number;
  gold: number;
  purchased: boolean;
  onBuy: () => void;
}

export function PurchasableGearItem({ instance, price, gold, purchased, onBuy }: PurchasableGearItemProps) {
  const title = getGearInstanceTitle(instance);
  const { canPurchase } = getShopPurchaseState(price, gold, purchased);
  const media = (
    <GearTile
      instance={instance}
      interactionKey="shop"
      as="button"
      shine={!purchased}
      interactiveChrome={!purchased}
      disabled={!canPurchase}
      onClick={canPurchase ? onBuy : undefined}
      ariaLabel={getShopItemAriaLabel(title, purchased)}
    >
      <ShopPriceChip price={price} gold={gold} purchased={purchased} />
    </GearTile>
  );

  return <PurchasableShopTile media={media} purchased={purchased} />;
}
