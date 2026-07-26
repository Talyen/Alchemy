// Equipment Shop — buy gear or refresh offerings.
import { RefreshCw } from "lucide-react";

import type { GearInstance } from "@/lib/gear";

import { PurchasableGearItem } from "../../shared/ui/purchasable-gear-item";
import { ServiceButton } from "../../shared/ui/shared-ui";
import { ShopBrowseOfferings, ShopBrowseShell } from "./shop-browse-shell";

export function EquipmentShopScreen({
  gold,
  gear,
  refreshesLeft,
  purchasedSlotKeys,
  getGearPrice,
  refreshPrice,
  onBuyGear,
  onRefresh,
  onContinue,
}: {
  gold: number;
  gear: GearInstance[];
  refreshesLeft: number;
  purchasedSlotKeys: string[];
  getGearPrice: (instance: GearInstance) => number;
  refreshPrice: number;
  onBuyGear: (instance: GearInstance) => boolean;
  onRefresh: () => void;
  onContinue: () => void;
}) {
  function handleBuy(instance: GearInstance) {
    if (purchasedSlotKeys.includes(instance.instanceId)) return;
    onBuyGear(instance);
  }

  return (
    <ShopBrowseShell title="Equipment Shop" gold={gold}>
      <ShopBrowseOfferings
        swapKey={gear.map((g) => g.instanceId).join("-")}
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
        {gear.map((instance, i) => (
          <PurchasableGearItem
            key={instance.instanceId}
            instance={instance}
            price={getGearPrice(instance)}
            gold={gold}
            purchased={purchasedSlotKeys.includes(instance.instanceId)}
            onBuy={() => handleBuy(instance)}
            staggerIndex={i}
          />
        ))}
      </ShopBrowseOfferings>
    </ShopBrowseShell>
  );
}
