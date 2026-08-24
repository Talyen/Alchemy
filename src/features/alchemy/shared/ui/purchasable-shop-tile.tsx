// Shared purchasable shop tile chrome — media slot + price / purchased chip.
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { CurrencyAmount } from "./display-elements";
import { DisabledTooltip } from "./service-button";

export function ShopPriceChip({ price, gold, purchased }: { price: number; gold: number; purchased: boolean }) {
  const canAfford = gold >= price;

  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 w-max -translate-x-1/2 select-none">
      {purchased ? (
        <span className="inline-flex items-center justify-center rounded-full border border-border/50 bg-stone-950/85 px-4 py-1.5 text-base leading-none font-semibold text-muted-foreground shadow-md backdrop-blur-sm">
          Purchased
        </span>
      ) : (
        <DisabledTooltip show={!canAfford} message="Not Enough Gold">
          <div
            className={cn(
              "pointer-events-auto inline-flex items-center justify-center gap-2 rounded-full px-4 py-1.5 text-base leading-none font-semibold shadow-md backdrop-blur-sm",
              canAfford
                ? "border border-yellow-400/40 bg-yellow-300/15 text-yellow-300"
                : "border border-border/50 bg-stone-950/85 text-muted-foreground",
            )}
          >
            <CurrencyAmount
              amount={price}
              suffix=" Gold"
              iconClassName={cn("h-6 w-6", canAfford ? "text-yellow-300" : "text-muted-foreground")}
              className="whitespace-nowrap"
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
