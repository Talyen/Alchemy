// Equipment Shop — buy gear or refresh offerings.
import type { GearInstance } from "@/lib/gear";

import { PurchasableGearItem } from "../../shared/ui/purchasable-gear-item";
import { RefreshShopServiceButton, ShopBrowseOfferings, ShopBrowseShell } from "./shop-browse-shell";

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
  onOpenMenu,
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
  onOpenMenu: (rect?: DOMRect) => void;
}) {
  return (
    <ShopBrowseShell title="Equipment Shop" gold={gold} onOpenMenu={onOpenMenu}>
      <ShopBrowseOfferings
        swapKey={gear.map((g) => g.instanceId).join("-")}
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
        {gear.map((instance) => (
          <PurchasableGearItem
            key={instance.instanceId}
            instance={instance}
            price={getGearPrice(instance)}
            gold={gold}
            purchased={purchasedSlotKeys.includes(instance.instanceId)}
            onBuy={() => onBuyGear(instance)}
          />
        ))}
      </ShopBrowseOfferings>
    </ShopBrowseShell>
  );
}
