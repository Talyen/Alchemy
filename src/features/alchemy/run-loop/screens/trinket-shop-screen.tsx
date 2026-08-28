import type { TrinketEntry } from "@/lib/game-data";

import { PurchasableTrinketItem } from "../../shared/ui/purchasable-trinket-item";
import { shopItemSlotKey, shopOfferingsSwapKey } from "../shop/shop-slot-keys";
import { RefreshShopServiceButton, ShopBrowseOfferings, ShopBrowseShell } from "./shop-browse-shell";

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
    <ShopBrowseShell title="Trinket Shop" gold={gold} onOpenMenu={onOpenMenu}>
      <ShopBrowseOfferings
        swapKey={shopOfferingsSwapKey(
          trinkets.map((t, i) => shopItemSlotKey(t.id, i)),
          refreshesLeft,
        )}
        onLeave={onContinue}
        services={
          <RefreshShopServiceButton
            gold={gold}
            refreshesLeft={refreshesLeft}
            refreshPrice={refreshPrice}
            onRefresh={onRefresh}
          />
        }
      >
        {trinkets.map((trinket, i) => {
          const slotKey = shopItemSlotKey(trinket.id, i);
          return (
            <PurchasableTrinketItem
              key={slotKey}
              trinket={trinket}
              price={getTrinketPrice(trinket)}
              gold={gold}
              purchased={purchasedSlotKeys.includes(slotKey)}
              onBuy={() => onBuyTrinket(trinket, slotKey)}
            />
          );
        })}
      </ShopBrowseOfferings>
    </ShopBrowseShell>
  );
}
