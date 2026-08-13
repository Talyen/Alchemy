// Trinket Shop — buy trinkets or refresh offerings.
import type { TrinketEntry } from "@/lib/game-data";

import { PurchasableTrinketItem } from "../../shared/ui/purchasable-trinket-item";
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
}) {
  return (
    <ShopBrowseShell title="Trinket Shop" gold={gold}>
      <ShopBrowseOfferings
        swapKey={trinkets.map((t) => t.id).join("-")}
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
          const slotKey = `${trinket.id}-${i}`;
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
