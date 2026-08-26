// Shop gear tile with buy button and sold-out state.
import type { GearInstance } from "@/lib/gear";
import { getGearInstanceTitle } from "@/lib/gear";
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
  const canAfford = gold >= price;
  const canPurchase = !purchased && canAfford;
  const media = (
    <GearTile
      instance={instance}
      interactionKey="shop"
      as="button"
      shine={!purchased}
      interactiveChrome={!purchased}
      disabled={!canPurchase}
      onClick={canPurchase ? onBuy : undefined}
      ariaLabel={purchased ? title : `Buy ${title}`}
    >
      <ShopPriceChip price={price} gold={gold} purchased={purchased} />
    </GearTile>
  );

  return <PurchasableShopTile media={media} purchased={purchased} />;
}
