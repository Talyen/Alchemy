// Equipment Shop — buy gear or refresh offerings.
import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BUTTON_WIDTH_ACTION } from "@/features/alchemy/shared/config";
import type { GearInstance } from "@/lib/gear";

import { PurchasableGearItem } from "../../shared/ui/purchasable-gear-item";
import { GoldDisplay, ScreenHeader, ServiceButton, StaggerGroup } from "../../shared/ui/shared-ui";

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
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-6 text-center">
      <ScreenHeader title="Equipment Shop" />
      <GoldDisplay gold={gold} />

      <StaggerGroup className="flex flex-col items-center gap-6">
        <StaggerGroup
          swapKey={gear.map((g) => g.instanceId).join("-")}
          animate={false}
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
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
