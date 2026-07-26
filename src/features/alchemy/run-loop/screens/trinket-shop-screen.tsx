// Trinket Shop — buy trinkets or refresh offerings.
import { RefreshCw } from "lucide-react";

import type { TrinketEntry } from "@/lib/game-data";

import { PurchasableTrinketItem } from "../../shared/ui/purchasable-trinket-item";
import { ServiceButton } from "../../shared/ui/shared-ui";
import { ShopBrowseOfferings, ShopBrowseShell } from "./shop-browse-shell";

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
  function handleBuy(trinket: TrinketEntry, slotKey: string) {
    if (purchasedSlotKeys.includes(slotKey)) return;
    onBuyTrinket(trinket, slotKey);
  }

  return (
    <ShopBrowseShell title="Trinket Shop" gold={gold}>
      <ShopBrowseOfferings
        swapKey={trinkets.map((t) => t.id).join("-")}
        onLeave={onContinue}
        services={
          <ServiceButton
            icon={RefreshCw}
            label="Refresh"
            cost={refreshPrice}
            disabled={refreshesLeft <= 0 || gold < refreshPrice}
            disabledMessage="Not Enough Gold"
            used={refreshesLeft <= 0}
            soldOutText="Refresh — Sold Out"
            onClick={onRefresh}
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
              onBuy={() => handleBuy(trinket, slotKey)}
              staggerIndex={i}
            />
          );
        })}
      </ShopBrowseOfferings>
    </ShopBrowseShell>
  );
}
