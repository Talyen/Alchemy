import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { CurrencyAmount } from "../../../shared/ui/display-elements";
import { DisabledTooltip } from "../../../shared/ui/tooltips/disabled-tooltip";
import type { ShopPurchaseState } from "./purchasable-shop-helpers";

export function ShopPriceChip({
  price,
  purchased,
  purchaseState,
}: {
  price: number;
  purchased: boolean;
  purchaseState: ShopPurchaseState;
}) {
  const { canAfford } = purchaseState;

  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 w-max -translate-x-1/2 select-none">
      {purchased ? (
        <span className="inline-flex items-center justify-center text-xl leading-none font-semibold text-muted-foreground drop-shadow-[0_0_2px_rgba(0,0,0,0.95)] drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
          Purchased
        </span>
      ) : (
        <DisabledTooltip show={!canAfford} message="Not Enough Gold">
          <div
            className={cn(
              "pointer-events-auto inline-flex items-center justify-center gap-1.5 text-xl leading-none font-semibold tabular-nums",
              canAfford ? "text-amber-200" : "text-muted-foreground",
            )}
          >
            <CurrencyAmount
              amount={price}
              iconClassName="drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] drop-shadow-[0_0_2px_rgba(0,0,0,0.95)]"
              className="whitespace-nowrap drop-shadow-[0_0_2px_rgba(0,0,0,0.95)] drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]"
            />
          </div>
        </DisabledTooltip>
      )}
    </div>
  );
}

export function PurchasableShopTile({ media, purchased }: { media: ReactNode; purchased: boolean }) {
  return (
    <div className={cn("relative flex flex-col items-center text-center", purchased && "opacity-50")}>{media}</div>
  );
}
