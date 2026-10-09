import type { TrinketEntry } from "@/lib/game-data";

import { PurchasableTrinketItem } from "../shop/ui/purchasable-shop-item";
import { shopItemSlotKey } from "../shop/shop-slot-keys";
import { GenericShopScreen } from "./generic-shop-screen";

export function TrinketShopScreen({
  gold,
  trinkets,
  refreshesLeft,
  purchasedSlotKeys,
  getTrinketPrice,
  refreshPrice,
  onBuyTrinket,
  onRefresh,
  onContinue,
  isProgressSavePending = () => false,
}: {
  gold: number;
  trinkets: TrinketEntry[];
  refreshesLeft: number;
  purchasedSlotKeys: string[];
  getTrinketPrice: (trinket: TrinketEntry) => number;
  refreshPrice: number;
  onBuyTrinket: (trinket: TrinketEntry, slotKey: string) => boolean;
  onRefresh: () => void;
  onContinue: () => void;
  isProgressSavePending?: () => boolean;
}) {
  return (
    <GenericShopScreen
      title="Trinket Shop"
      gold={gold}
      items={trinkets}
      refreshesLeft={trinkets.length > 0 ? refreshesLeft : 0}
      refreshPrice={refreshPrice}
      purchasedSlotKeys={purchasedSlotKeys}
      getSlotKey={(t, i) => shopItemSlotKey(t.id, i)}
      getPrice={getTrinketPrice}
      onBuy={onBuyTrinket}
      onRefresh={onRefresh}
      onContinue={onContinue}
      isProgressSavePending={isProgressSavePending}
      extraServices={trinkets.length === 0 ? <p role="status">All Trinkets have been collected.</p> : undefined}
      renderItem={(trinket, price, purchased, onBuy) => (
        <PurchasableTrinketItem trinket={trinket} price={price} gold={gold} purchased={purchased} onBuy={onBuy} />
      )}
    />
  );
}
