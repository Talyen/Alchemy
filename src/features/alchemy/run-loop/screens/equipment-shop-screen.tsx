import type { GearInstance } from "@/lib/gear";

import { PurchasableGearItem } from "../../shared/ui/purchasable-shop-item";
import { GenericShopScreen } from "./generic-shop-screen";

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
    <GenericShopScreen
      title="Equipment Shop"
      gold={gold}
      items={gear}
      refreshesLeft={refreshesLeft}
      refreshPrice={refreshPrice}
      purchasedSlotKeys={purchasedSlotKeys}
      getSlotKey={(g) => g.instanceId}
      getPrice={getGearPrice}
      onBuy={(instance) => onBuyGear(instance)}
      onRefresh={onRefresh}
      onContinue={onContinue}
      onOpenMenu={onOpenMenu}
      renderItem={(instance, price, purchased, onBuy) => (
        <PurchasableGearItem instance={instance} price={price} gold={gold} purchased={purchased} onBuy={onBuy} />
      )}
    />
  );
}
