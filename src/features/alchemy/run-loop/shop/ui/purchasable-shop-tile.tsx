import { useGameTranslation } from "@/components/use-game-translation";

import { cn } from "@/lib/utils";

import { CurrencyAmount } from "../../../shared/ui/display-elements";

export function ShopPriceChip({
  price,
  purchased,
  canAfford,
}: {
  price: number;
  purchased: boolean;
  canAfford: boolean;
}) {
  const i18n = useGameTranslation();

  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 w-max -translate-x-1/2 select-none">
      {purchased ? (
        <span className="inline-flex items-center justify-center text-xl leading-none font-semibold text-muted-foreground drop-shadow-[0_0_2px_rgba(0,0,0,0.95)] drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
          {i18n.text("ui.purchasable-shop-tile.1", "Purchased")}
        </span>
      ) : (
        <div
          className={cn(
            "pointer-events-auto inline-flex items-center justify-center gap-1.5 text-xl leading-none font-semibold tabular-nums",
            canAfford ? "text-gold-pale" : "text-muted-foreground",
          )}
        >
          <CurrencyAmount
            amount={price}
            iconClassName="drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] drop-shadow-[0_0_2px_rgba(0,0,0,0.95)]"
            className="whitespace-nowrap drop-shadow-[0_0_2px_rgba(0,0,0,0.95)] drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]"
          />
        </div>
      )}
    </div>
  );
}
