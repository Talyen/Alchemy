import type { TrinketEntry } from "@/lib/game-data";

import { PurchasableTrinketItem } from "../../shared/ui/purchasable-shop-item";
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
  onOpenMenu,
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
  onOpenMenu: (rect?: DOMRect) => void;
}) {
  return (
    <GenericShopScreen
      title="Trinket Shop"
      gold={gold}
      items={trinkets}
      refreshesLeft={refreshesLeft}
      refreshPrice={refreshPrice}
      purchasedSlotKeys={purchasedSlotKeys}
      getSlotKey={(t, i) => shopItemSlotKey(t.id, i)}
      getPrice={getTrinketPrice}
      onBuy={onBuyTrinket}
      onRefresh={onRefresh}
      onContinue={onContinue}
      onOpenMenu={onOpenMenu}
      renderItem={(trinket, price, purchased, onBuy) => (
        <PurchasableTrinketItem trinket={trinket} price={price} gold={gold} purchased={purchased} onBuy={onBuy} />
      )}
    />
  );
}
