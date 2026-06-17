// Trinket Shop — buy trinkets or refresh offerings.
import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BUTTON_WIDTH_ACTION } from "@/features/alchemy/shared/config";
import type { TrinketEntry } from "@/lib/game-data";

import { PurchasableTrinketItem } from "../../shared/ui/purchasable-trinket-item";
import { GoldDisplay, ScreenHeader, ServiceButton, StaggerGroup } from "../../shared/ui/shared-ui";

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
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-6 text-center">
      <ScreenHeader title="Trinket Shop" />
      <GoldDisplay gold={gold} />

      <StaggerGroup className="flex flex-col items-center gap-6">
        <StaggerGroup
          swapKey={trinkets.map((t) => t.id).join("-")}
          animate={false}
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
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
        </StaggerGroup>

        <div className="flex flex-wrap justify-center gap-3">
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
        </div>
        <Button size="lg" variant="primary" className={cn("mt-2", BUTTON_WIDTH_ACTION)} onClick={onContinue}>
          Leave
        </Button>
      </StaggerGroup>
    </div>
  );
}
